import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const response = await fetch('https://api.spotify.com/v1/me/following?type=artist&limit=50', {
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
            },
        })

        if (!response.ok) {
            const error = await response.json()
            return NextResponse.json(error, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data.artists)
    } catch (error) {
        console.error("Error fetching followed artists:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
