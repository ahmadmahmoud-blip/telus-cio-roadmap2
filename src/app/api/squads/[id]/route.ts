import { NextResponse } from 'next/server'
export async function PUT() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
export async function DELETE() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
