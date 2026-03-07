import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { kv } from '@vercel/kv';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const username = searchParams.get('username');

        let key: string;
        if (owner && repo) {
            key = `chat:${session.user.id}:${owner}:${repo}`;
        } else if (username) {
            key = `chat:${session.user.id}:profile:${username}`;
        } else {
            return NextResponse.json({ error: 'Missing repository or profile parameters' }, { status: 400 });
        }

        const messages = await kv.get(key) || [];
        return NextResponse.json({ messages });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { owner, repo, username, messages } = body;

        let key: string;
        if (owner && repo) {
            key = `chat:${session.user.id}:${owner}:${repo}`;
        } else if (username) {
            key = `chat:${session.user.id}:profile:${username}`;
        } else {
            return NextResponse.json({ error: 'Missing repository or profile parameters' }, { status: 400 });
        }

        // Store messages in KV, set an expiration if needed, e.g., 30 days
        // await kv.set(key, messages, { ex: 60 * 60 * 24 * 30 });
        await kv.set(key, messages);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving chat history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const username = searchParams.get('username');

        let key: string;
        if (owner && repo) {
            key = `chat:${session.user.id}:${owner}:${repo}`;
        } else if (username) {
            key = `chat:${session.user.id}:profile:${username}`;
        } else {
            return NextResponse.json({ error: 'Missing repository or profile parameters' }, { status: 400 });
        }

        await kv.del(key);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
