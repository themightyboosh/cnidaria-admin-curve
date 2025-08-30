'use client'

import { RouterProvider } from 'react-router-dom'
import { router } from '../src/router'

export default function HomePage() {
  // Next.js client-side rendering for React Router
  return (
    <div id="root">
      <RouterProvider router={router} />
    </div>
  )
}
