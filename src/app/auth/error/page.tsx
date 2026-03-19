"use client"
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const t = useTranslations("System")

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'OAuthSignin':
        return t("error_oauth_signin")
      case 'OAuthCallback':
        return t("error_oauth_callback")
      case 'OAuthCreateAccount':
        return t("error_oauth_create_account")
      case 'EmailCreateAccount':
        return t("error_email_create_account")
      case 'Callback':
        return t("error_callback")
      case 'OAuthAccountNotLinked':
        return t("error_oauth_account_not_linked")
      case 'EmailSignin':
        return t("error_email_signin")
      case 'CredentialsSignin':
        return t("error_credentials_signin")
      case 'SessionRequired':
        return t("error_session_required")
      default:
        return t("error_unknown")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            {t("authentication_error")}
          </h1>
          <p className="text-foreground/70 mb-6">
            {getErrorMessage(error)}
          </p>
          <Button 
            onClick={() => window.location.href = '/auth/login'}
            className="w-full"
          >
            {t("back_to_login")}
          </Button>
        </div>
      </div>
    </div>
  )
}