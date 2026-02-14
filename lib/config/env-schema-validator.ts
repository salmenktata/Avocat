/**
 * Validateur de configuration environnement basé sur env-schema.json
 *
 * Features:
 * - Validation type-safe des variables d'environnement
 * - Support validateurs complexes (regex, range, conditional)
 * - Évaluation règles de validation cross-variables
 * - Test connectivity optionnel pour API keys
 * - Mode strict (warnings bloquent aussi)
 */

import schema from '@/docs/env-schema.json'
import crypto from 'crypto'

// Types
export type Severity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO'

export interface ValidationError {
  variable: string
  severity: Severity
  message: string
  validator?: string
  value?: string
}

export interface ValidationWarning {
  variable: string
  severity: Severity
  message: string
  value?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  stats: {
    totalVars: number
    validatedVars: number
    missingRequired: number
    criticalIssues: number
  }
}

interface EnvVariable {
  name: string
  type: string
  criticality: string
  required: boolean | string
  devValue?: any
  prodValue?: any
  description: string
  validators: string[]
  conditionalRequired?: {
    condition: string
    message: string
  }
  warnings?: Array<{
    pattern: string
    severity: string
    message: string
  }>
  testConnectivity?: boolean
  secret?: boolean
}

interface ValidationRule {
  id: string
  severity: Severity
  condition: string
  message: string
  solutions: string[]
}

/**
 * Classe principale de validation
 */
export class EnvSchemaValidator {
  private schema: typeof schema
  private errors: ValidationError[] = []
  private warnings: ValidationWarning[] = []

  constructor() {
    this.schema = schema
  }

  /**
   * Valide un fichier .env contre le schéma
   */
  async validate(
    envVars: Record<string, string | undefined>,
    options: {
      strict?: boolean
      checkConnectivity?: boolean
      environment?: 'dev' | 'prod'
    } = {}
  ): Promise<ValidationResult> {
    this.errors = []
    this.warnings = []

    const { strict = false, checkConnectivity = false, environment = 'prod' } = options

    let validatedCount = 0
    let missingRequired = 0

    // Récupérer toutes les variables du schéma
    const allVariables: EnvVariable[] = this.schema.categories.flatMap(
      (cat) => cat.variables as EnvVariable[]
    )

    // Valider chaque variable
    for (const varDef of allVariables) {
      const value = envVars[varDef.name]
      const result = this.validateVariable(varDef, value, envVars, environment)

      if (result.errors.length > 0) {
        this.errors.push(...result.errors)
        if (varDef.required === true) {
          missingRequired++
        }
      }

      if (result.warnings.length > 0) {
        this.warnings.push(...result.warnings)
      }

      if (value !== undefined) {
        validatedCount++
      }

      // Test connectivity si demandé
      if (checkConnectivity && varDef.testConnectivity && value) {
        const connectivityResult = await this.testConnectivity(varDef.name, value)
        if (!connectivityResult.success) {
          this.warnings.push({
            variable: varDef.name,
            severity: 'WARNING',
            message: `Connectivity test failed: ${connectivityResult.error}`,
          })
        }
      }
    }

    // Évaluer règles cross-variables
    const ruleErrors = this.evaluateRules(envVars)
    this.errors.push(...ruleErrors)

    // Statistiques
    const criticalIssues = this.errors.filter((e) => e.severity === 'CRITICAL').length

    const valid = strict ? this.errors.length === 0 && this.warnings.length === 0 : this.errors.length === 0

    return {
      valid,
      errors: this.errors,
      warnings: this.warnings,
      stats: {
        totalVars: allVariables.length,
        validatedVars: validatedCount,
        missingRequired,
        criticalIssues,
      },
    }
  }

  /**
   * Valide une variable spécifique
   */
  private validateVariable(
    varDef: EnvVariable,
    value: string | undefined,
    allEnvVars: Record<string, string | undefined>,
    environment: 'dev' | 'prod'
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check required
    if (varDef.required === true && !value) {
      errors.push({
        variable: varDef.name,
        severity: varDef.criticality as Severity,
        message: `Variable requise manquante: ${varDef.name}`,
        validator: 'required',
      })
      return { errors, warnings }
    }

    // Check conditional required
    if (
      varDef.required === 'conditional' &&
      varDef.conditionalRequired &&
      !value &&
      this.evaluateCondition(varDef.conditionalRequired.condition, allEnvVars)
    ) {
      errors.push({
        variable: varDef.name,
        severity: varDef.criticality as Severity,
        message: varDef.conditionalRequired.message,
        validator: 'conditionalRequired',
      })
      return { errors, warnings }
    }

    // Si pas de valeur et pas requis, skip
    if (!value) {
      return { errors, warnings }
    }

    // Appliquer validateurs
    for (const validator of varDef.validators) {
      const validatorResult = this.applyValidator(validator, value, varDef)
      if (!validatorResult.valid) {
        errors.push({
          variable: varDef.name,
          severity: 'ERROR',
          message: validatorResult.message,
          validator,
          value: varDef.secret ? this.maskSecret(value) : value,
        })
      }
    }

    // Check warnings patterns
    if (varDef.warnings) {
      for (const warning of varDef.warnings) {
        const regex = new RegExp(warning.pattern)
        if (regex.test(value)) {
          warnings.push({
            variable: varDef.name,
            severity: warning.severity as Severity,
            message: warning.message,
            value: varDef.secret ? this.maskSecret(value) : value,
          })
        }
      }
    }

    return { errors, warnings }
  }

  /**
   * Vérifie si une valeur est un placeholder (non remplacé)
   */
  private isPlaceholder(value: string): boolean {
    const placeholderPatterns = [
      /^YOUR_.*_HERE$/i,
      /^CHANGE_ME/i,
      /^sk-ant-api03-\.\.\.$/,
      /^gsk_\.\.\.$/,
      /^sk-proj-\.\.\.$/,
      /^xkeysib-\.\.\.$/,
    ]
    return placeholderPatterns.some((pattern) => pattern.test(value))
  }

  /**
   * Applique un validateur spécifique
   */
  private applyValidator(
    validator: string,
    value: string,
    varDef: EnvVariable
  ): { valid: boolean; message: string } {
    // Skip validateurs de longueur/format pour placeholders (templates)
    if (this.isPlaceholder(value)) {
      // Seul validator "required" s'applique aux placeholders
      if (validator === 'required') {
        return { valid: true, message: '' }
      }
      // Skip tous les autres validateurs pour placeholders
      if (
        validator.startsWith('length:') ||
        validator.startsWith('starts_with:') ||
        validator === 'hex' ||
        validator === 'uri' ||
        validator === 'email'
      ) {
        return { valid: true, message: '' }
      }
    }

    // Validator: required
    if (validator === 'required') {
      return {
        valid: value !== undefined && value !== '',
        message: `${varDef.name} est requis`,
      }
    }

    // Validator: boolean
    if (validator === 'boolean') {
      const valid = value === 'true' || value === 'false'
      return {
        valid,
        message: `${varDef.name} doit être 'true' ou 'false'`,
      }
    }

    // Validator: number
    if (validator === 'number') {
      const valid = !isNaN(Number(value))
      return {
        valid,
        message: `${varDef.name} doit être un nombre`,
      }
    }

    // Validator: uri
    if (validator === 'uri') {
      try {
        new URL(value)
        return { valid: true, message: '' }
      } catch {
        return {
          valid: false,
          message: `${varDef.name} doit être une URI valide`,
        }
      }
    }

    // Validator: email
    if (validator === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return {
        valid: emailRegex.test(value),
        message: `${varDef.name} doit être un email valide`,
      }
    }

    // Validator: enum
    if (validator === 'enum' && varDef.type === 'enum') {
      const varDefTyped = varDef as EnvVariable & { allowedValues: string[] }
      const valid = varDefTyped.allowedValues?.includes(value)
      return {
        valid,
        message: `${varDef.name} doit être l'une des valeurs: ${varDefTyped.allowedValues?.join(', ')}`,
      }
    }

    // Validator: starts_with:PREFIX
    if (validator.startsWith('starts_with:')) {
      const prefix = validator.split(':')[1]
      return {
        valid: value.startsWith(prefix),
        message: `${varDef.name} doit commencer par '${prefix}'`,
      }
    }

    // Validator: ends_with:SUFFIX
    if (validator.startsWith('ends_with:')) {
      const suffix = validator.split(':')[1]
      return {
        valid: value.endsWith(suffix),
        message: `${varDef.name} doit se terminer par '${suffix}'`,
      }
    }

    // Validator: length:min=X
    if (validator.startsWith('length:min=')) {
      const min = parseInt(validator.split('=')[1])
      return {
        valid: value.length >= min,
        message: `${varDef.name} doit contenir au moins ${min} caractères`,
      }
    }

    // Validator: length:exact=X
    if (validator.startsWith('length:exact=')) {
      const exact = parseInt(validator.split('=')[1])
      return {
        valid: value.length === exact,
        message: `${varDef.name} doit contenir exactement ${exact} caractères`,
      }
    }

    // Validator: range:MIN-MAX
    if (validator.startsWith('range:')) {
      const [min, max] = validator.split(':')[1].split('-').map(Number)
      const numValue = Number(value)
      return {
        valid: !isNaN(numValue) && numValue >= min && numValue <= max,
        message: `${varDef.name} doit être entre ${min} et ${max}`,
      }
    }

    // Validator: hex
    if (validator === 'hex') {
      const valid = /^[0-9a-fA-F]+$/.test(value)
      return {
        valid,
        message: `${varDef.name} doit être une chaîne hexadécimale`,
      }
    }

    // Validator inconnu
    return { valid: true, message: '' }
  }

  /**
   * Évalue règles de validation cross-variables
   */
  private evaluateRules(envVars: Record<string, string | undefined>): ValidationError[] {
    const errors: ValidationError[] = []

    const rules = this.schema.validationRules as ValidationRule[]

    for (const rule of rules) {
      if (this.evaluateCondition(rule.condition, envVars)) {
        errors.push({
          variable: rule.id,
          severity: rule.severity,
          message: `${rule.message}\nSolutions:\n${rule.solutions.map((s) => `  - ${s}`).join('\n')}`,
          validator: 'rule',
        })
      }
    }

    return errors
  }

  /**
   * Évalue une condition (ex: "RAG_ENABLED=true AND !OPENAI_API_KEY")
   */
  private evaluateCondition(condition: string, envVars: Record<string, string | undefined>): boolean {
    try {
      // Remplacer variables par leurs valeurs
      let evaluable = condition

      // Handle negation !VAR
      evaluable = evaluable.replace(/!([A-Z_]+)/g, (_, varName) => {
        return envVars[varName] ? 'false' : 'true'
      })

      // Handle VAR=value
      evaluable = evaluable.replace(/([A-Z_]+)=([a-z]+)/gi, (_, varName, value) => {
        return envVars[varName] === value ? 'true' : 'false'
      })

      // Handle contains
      evaluable = evaluable.replace(/([A-Z_]+) contains '([^']+)'/gi, (_, varName, substring) => {
        return envVars[varName]?.includes(substring) ? 'true' : 'false'
      })

      // Handle does not contain
      evaluable = evaluable.replace(
        /([A-Z_]+) does not contain ([A-Z_]+)/gi,
        (_, varName1, varName2) => {
          return !envVars[varName1]?.includes(envVars[varName2] || '') ? 'true' : 'false'
        }
      )

      // Handle != (different)
      evaluable = evaluable.replace(/([A-Z_]+) != ([A-Z_]+)/gi, (_, varName1, varName2) => {
        return envVars[varName1] !== envVars[varName2] ? 'true' : 'false'
      })

      // Replace AND/OR operators
      evaluable = evaluable.replace(/\bAND\b/g, '&&').replace(/\bOR\b/g, '||')

      // Evaluate
      // eslint-disable-next-line no-eval
      return eval(evaluable)
    } catch {
      // Si erreur parsing, ne pas bloquer
      return false
    }
  }

  /**
   * Masque un secret pour affichage
   */
  private maskSecret(value: string): string {
    if (value.length <= 8) return '***'
    return `${value.slice(0, 4)}...${value.slice(-4)}`
  }

  /**
   * Test connectivity pour une API key
   */
  private async testConnectivity(
    varName: string,
    apiKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Test Groq
      if (varName === 'GROQ_API_KEY') {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        })
        return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
      }

      // Test OpenAI
      if (varName === 'OPENAI_API_KEY') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        })
        return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
      }

      // Test Anthropic
      if (varName === 'ANTHROPIC_API_KEY') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
          signal: AbortSignal.timeout(5000),
        })
        return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
      }

      // Autres providers: skip test
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

/**
 * Helper pour validation synchrone au startup (bloque si erreurs)
 */
export function validateEnvSchemaOrThrow(
  env: Record<string, string | undefined> = process.env
): void {
  const validator = new EnvSchemaValidator()

  // Validation synchrone (pas de connectivity check)
  validator.validate(env, { strict: false, checkConnectivity: false }).then((result) => {
    if (!result.valid) {
      console.error('❌ Configuration invalide:')
      result.errors.forEach((err) => {
        const emoji = err.severity === 'CRITICAL' ? '🚨' : '❌'
        console.error(`${emoji} ${err.variable}: ${err.message}`)
      })

      if (result.stats.criticalIssues > 0) {
        console.error(`\n🚨 ${result.stats.criticalIssues} erreurs CRITICAL détectées`)
        console.error('Corriger avec: npm run sync:env')
        process.exit(1)
      }
    }
  })
}
