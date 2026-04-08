'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export function LoginForm() {
  const [pat, setPat] = useState('')
  const [org, setOrg] = useState('IsbelSA')
  const [project, setProject] = useState('Proyectos')
  const [showPat, setShowPat] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/azure/me', {
        headers: {
          'x-azure-pat': pat,
          'x-azure-org': org,
          'x-azure-project': project,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al conectar. Verificá tu PAT.')
        return
      }

      login({ pat, org, project }, data)
      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-600 text-white rounded-xl p-3">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M0 12L2.4 5.4 5 11.4 9 1 12 11H24L13.5 17.6 16.4 24 12 20.6 7.6 24 10.5 17.6Z" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">AzuHours</CardTitle>
          <CardDescription className="text-gray-500">
            Cargá tus horas en Azure DevOps de forma fácil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="org">Organización</Label>
              <Input
                id="org"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="IsbelSA"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="project">Proyecto</Label>
              <Input
                id="project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="Proyectos"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pat">Personal Access Token</Label>
              <div className="relative">
                <Input
                  id="pat"
                  type={showPat ? 'text' : 'password'}
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="Pegá tu PAT aquí"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPat(!showPat)}
                >
                  {showPat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Tu PAT se guarda solo en esta sesión del navegador.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !pat}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                'Conectar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
