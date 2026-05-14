import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseServer = await createClient();
  const { data: { session } } = await supabaseServer.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized access. Session required." }, { status: 401 });
  }

  const client = supabase;
  if (!client) {
    return NextResponse.json({ error: "Database configuration missing." }, { status: 500 });
  }

  try {
    const { data, error } = await client
      .from('live_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ tickets: data });
  } catch (err: any) {
    console.error("Error fetching admin tickets:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
