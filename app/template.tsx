export default function Template({ children }: { children: React.ReactNode }) {
    // PageWrapper is the single route-motion owner for the authenticated app.
    // Keeping this template structural avoids a second transform/opacity
    // handoff that could re-layout fixed surfaces and modal positioning.
    return <>{children}</>
}
