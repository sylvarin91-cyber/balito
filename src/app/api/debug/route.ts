import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return NextResponse.json({
    url: url ? `SET (ends with ...${url.slice(-10)})` : "MISSING",
    urlLength: url?.length,
    key: key ? `SET (ends with ...${key.slice(-10)})` : "MISSING",
    keyLength: key?.length,
  });
}
