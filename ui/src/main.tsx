import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import './styles/global.css'
import App from './App.tsx'
import { ConfigErrorScreen } from './components/ConfigErrorScreen.tsx'
import { loadConfig, setConfig, type AppConfig } from './config.ts'
import { describeError } from './api/errors.ts'
import { amplifyTheme } from './theme/amplifyTheme.ts'

function configureAmplify(config: AppConfig): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: { email: true },
      },
    },
  })
}

const signInComponents = {
  Header() {
    return (
      <div className="sign-in-header">
        <span className="wordmark wordmark-on-light">HR Leave Portal</span>
        <p className="muted">For HR staff. Sign in with the account your administrator created.</p>
      </div>
    )
  },
}

async function bootstrap(container: HTMLElement): Promise<void> {
  const root = createRoot(container)
  try {
    const config = await loadConfig()
    setConfig(config)
    configureAmplify(config)
  } catch (error) {
    console.error('Failed to load app configuration:', describeError(error))
    root.render(<ConfigErrorScreen message={describeError(error)} />)
    return
  }

  root.render(
    <StrictMode>
      <ThemeProvider theme={amplifyTheme}>
        <Authenticator hideSignUp components={signInComponents}>
          {({ signOut }) => <App onSignOut={() => signOut?.()} />}
        </Authenticator>
      </ThemeProvider>
    </StrictMode>,
  )
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('The #root element is missing from index.html.')
}
void bootstrap(container)
