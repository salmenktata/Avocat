'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icons } from '@/lib/icons'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { Separator } from '@/components/ui/separator'

interface ProfileFormProps {
  profile: {
    id: string
    nom?: string
    prenom?: string
  } | null
  userEmail: string
}

export default function ProfileForm({ profile, userEmail }: ProfileFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [formData, setFormData] = useState({
    prenom: profile?.prenom || '',
    nom: profile?.nom || '',
    email: userEmail,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      // Mettre à jour le profil (nom, prénom)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nom: formData.nom,
          prenom: formData.prenom,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile?.id)

      if (profileError) throw profileError

      // Mettre à jour l'email si modifié
      if (formData.email !== userEmail) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })
        if (emailError) throw emailError

        toast({
          title: 'Email mis à jour',
          description: 'Veuillez vérifier votre nouvelle adresse email pour confirmer le changement.',
        })
      }

      toast({
        title: 'Profil mis à jour',
        description: 'Vos informations ont été enregistrées avec succès.',
      })

      router.refresh()
    } catch (error: any) {
      console.error('Erreur mise à jour profil:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le profil',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
      })
      return
    }

    if (formData.newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 6 caractères',
      })
      return
    }

    setIsChangingPassword(true)

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      })

      if (error) throw error

      toast({
        title: 'Mot de passe modifié',
        description: 'Votre mot de passe a été changé avec succès.',
      })

      // Réinitialiser les champs
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de changer le mot de passe',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Informations personnelles */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Informations personnelles</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                placeholder="Mohamed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Ben Ahmed"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemple.tn"
            />
            {formData.email !== userEmail && (
              <p className="text-sm text-yellow-600">
                ⚠️ La modification de l'email nécessitera une vérification
              </p>
            )}
          </div>
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Icons.loader className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Icons.save className="mr-2 h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </form>

      <Separator />

      {/* Changement de mot de passe */}
      <form onSubmit={handlePasswordChange} className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Changer le mot de passe</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Minimum 6 caractères"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Retaper le mot de passe"
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          variant="outline"
          disabled={isChangingPassword || !formData.newPassword || !formData.confirmPassword}
        >
          {isChangingPassword ? (
            <>
              <Icons.loader className="mr-2 h-4 w-4 animate-spin" />
              Modification...
            </>
          ) : (
            <>
              <Icons.key className="mr-2 h-4 w-4" />
              Changer le mot de passe
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
