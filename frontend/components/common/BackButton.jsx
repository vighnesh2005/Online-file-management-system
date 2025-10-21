"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export default function BackButton({ className = "" }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className={`h-8 px-3 inline-flex items-center gap-2 border border-border bg-background text-foreground transition-all duration-150 hover:bg-blue-600 hover:text-white ${className}`}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
      <span className="text-sm">Back</span>
    </button>
  )
}
