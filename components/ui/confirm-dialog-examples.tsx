'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icons } from '@/lib/icons'

/**
 * Exemple 1 : Utilisation avec état local (pattern controlled)
 */
export function DeleteClientExample() {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleDelete = async () => {
    // Simuler un appel API
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Client supprimé')
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setIsOpen(true)}>
        <Icons.delete className="mr-2 h-4 w-4" />
        Supprimer le client
      </Button>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Supprimer le client ?"
        description="Cette action est irréversible. Le client et toutes ses données associées seront définitivement supprimés."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="destructive"
        icon="danger"
        onConfirm={handleDelete}
      />
    </>
  )
}

/**
 * Exemple 2 : Utilisation du hook useConfirmDialog (plus simple)
 */
export function ArchiveDossierExample() {
  const { confirm, dialog } = useConfirmDialog()

  const handleArchive = async () => {
    const confirmed = await confirm({
      title: 'Archiver le dossier ?',
      description:
        'Le dossier sera déplacé vers les archives. Vous pourrez le restaurer à tout moment.',
      confirmLabel: 'Archiver',
      variant: 'default',
      icon: 'warning',
      onConfirm: async () => {
        // Simuler un appel API
        await new Promise((resolve) => setTimeout(resolve, 1000))
        console.log('Dossier archivé')
      },
    })

    if (confirmed) {
      // Action réussie
      console.log('Archivage confirmé')
    }
  }

  return (
    <>
      {dialog}
      <Button variant="outline" onClick={handleArchive}>
        <Icons.archive className="mr-2 h-4 w-4" />
        Archiver
      </Button>
    </>
  )
}

/**
 * Exemple 3 : Clôturer un dossier
 */
export function CloseDossierExample() {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleClose = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Dossier clôturé')
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Icons.checkCircle className="mr-2 h-4 w-4" />
        Clôturer le dossier
      </Button>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Clôturer le dossier ?"
        description="Une fois clôturé, le dossier ne pourra plus être modifié. Vous pourrez toujours le consulter."
        confirmLabel="Clôturer"
        variant="default"
        icon="question"
        onConfirm={handleClose}
      />
    </>
  )
}

/**
 * Exemple 4 : Annuler une facture
 */
export function CancelInvoiceExample() {
  const { confirm, dialog } = useConfirmDialog()

  const handleCancel = async () => {
    await confirm({
      title: 'Annuler la facture ?',
      description:
        'La facture sera marquée comme annulée. Cette action ne peut pas être annulée.',
      confirmLabel: 'Annuler la facture',
      cancelLabel: 'Retour',
      variant: 'destructive',
      icon: 'danger',
      onConfirm: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        console.log('Facture annulée')
      },
    })
  }

  return (
    <>
      {dialog}
      <Button variant="ghost" className="text-destructive" onClick={handleCancel}>
        <Icons.xCircle className="mr-2 h-4 w-4" />
        Annuler la facture
      </Button>
    </>
  )
}

/**
 * Exemple 5 : Suppression multiple avec compteur
 */
export function DeleteMultipleExample({ count = 5 }: { count?: number }) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleDeleteMultiple = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    console.log(`${count} éléments supprimés`)
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setIsOpen(true)}>
        <Icons.delete className="mr-2 h-4 w-4" />
        Supprimer {count} élément{count > 1 ? 's' : ''}
      </Button>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`Supprimer ${count} élément${count > 1 ? 's' : ''} ?`}
        description={`Vous êtes sur le point de supprimer ${count} élément${count > 1 ? 's' : ''}. Cette action est irréversible.`}
        confirmLabel={`Supprimer ${count > 1 ? 'tout' : ''}`}
        variant="destructive"
        icon="danger"
        onConfirm={handleDeleteMultiple}
      />
    </>
  )
}

/**
 * Exemple 6 : Déconnexion
 */
export function LogoutExample() {
  const { confirm, dialog } = useConfirmDialog()

  const handleLogout = async () => {
    await confirm({
      title: 'Se déconnecter ?',
      description: 'Vous serez redirigé vers la page de connexion.',
      confirmLabel: 'Se déconnecter',
      variant: 'default',
      icon: 'info',
      onConfirm: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        console.log('Déconnexion')
      },
    })
  }

  return (
    <>
      {dialog}
      <Button variant="ghost" onClick={handleLogout}>
        <Icons.logout className="mr-2 h-4 w-4" />
        Se déconnecter
      </Button>
    </>
  )
}

/**
 * Exemple 7 : Quitter sans enregistrer
 */
export function UnsavedChangesExample() {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleDiscard = async () => {
    console.log('Modifications abandonnées')
    // Redirection ou fermeture
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen(true)}>
        Quitter sans enregistrer
      </Button>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Modifications non enregistrées"
        description="Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter ?"
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Rester"
        variant="destructive"
        icon="warning"
        onConfirm={handleDiscard}
      />
    </>
  )
}
