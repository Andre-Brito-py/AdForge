import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await db.workspaceMember.findFirst({
      where: { user: { email: session.user.email } }
    });

    if (!member) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { name, description, imageUrl, category, brandName, targetAudience, price } = await request.json();

    if (!name || !imageUrl) {
      return NextResponse.json({ error: "Name and image are required" }, { status: 400 });
    }

    const product = await db.product.create({
      data: {
        workspaceId: member.workspaceId,
        name,
        description,
        originalImageUrl: imageUrl,
        category,
        brandName,
        targetAudience,
        price
      }
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await db.workspaceMember.findFirst({
      where: { user: { email: session.user.email } }
    });

    if (!member) return NextResponse.json([]);

    const products = await db.product.findMany({
      where: { workspaceId: member.workspaceId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
