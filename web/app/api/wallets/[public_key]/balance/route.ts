import { NextRequest, NextResponse } from "next/server";
import { getStellarClient } from "@/lib/stellar/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ public_key: string }> },
) {
  try {
    const { public_key: publicKey } = await params;
    if (!publicKey) {
      return NextResponse.json({ error: "Missing public_key parameter" }, { status: 400 });
    }

    const stellar = getStellarClient();
    const balance = await stellar.getBalance(publicKey);

    return NextResponse.json({ balance });
  } catch (error) {
    console.error("Failed to fetch wallet balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet balance", balance: "0" },
      { status: 500 },
    );
  }
}
