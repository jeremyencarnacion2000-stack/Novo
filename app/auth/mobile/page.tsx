import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import * as jose from "jose";

export default async function MobileAuthBridge() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        // If not authenticated, redirect to the normal sign-in page, 
        // but tell it to come back here after.
        redirect("/auth/signin?callbackUrl=/auth/mobile");
    }

    // User is authenticated! Generate the specific mobile token.
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const token = await new jose.SignJWT({
        id: (session.user as any).id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role || 'user'
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secret);

    // Redirect to the Android URI Scheme
    redirect(`novoapp://auth?token=${token}`);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="animate-pulse text-4xl mb-8">✨</div>
                <h1 className="text-2xl font-bold">Authenticating...</h1>
                <p className="text-gray-400">Verifying session and returning to Novo Mobile app.</p>

                <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-sm mb-4">Click below if the app doesn't open automatically</p>
                    <a
                        href={`novoapp://auth?token=${token}`}
                        className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
                    >
                        Return to App
                    </a>
                </div>
            </div>
        </div>
    );
}
