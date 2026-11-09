interface ConfigErrorScreenProps {
  message: string
}

/** Full-page error when /config.json is missing or invalid (FR7.4). */
export function ConfigErrorScreen({ message }: ConfigErrorScreenProps) {
  return (
    <main className="full-page-message" data-testid="config-error-screen">
      <div>
        <span className="eyebrow">HR Leave Portal</span>
        <h1>Configuration error</h1>
        <div className="alert alert-error" role="alert">
          <p>{message}</p>
        </div>
        <p className="muted">
          The app could not read its configuration. If you are running it locally, copy
          public/config.example.json to public/config.json and fill in your stack outputs.
        </p>
      </div>
    </main>
  )
}
