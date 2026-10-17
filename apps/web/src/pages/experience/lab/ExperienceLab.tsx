import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate } from 'react-router'
import { installFakeServer, LAB_EXP, LAB_POC, stateFromUrl } from './fakeServer'

/**
 * Visual lab (dev builds only, never routed in production): the real Stellar Experience page over
 * an in-memory server. Open /lab/experience?stage=detection&phase=question&model=trace&target=source:FortiGate
 * to land on any state; the page's own controls then work as in a live session.
 */
export function ExperienceLab() {
  const qc = useQueryClient()
  // Installed before the page mounts, so its first requests already hit the fake server.
  useState(() => {
    installFakeServer(stateFromUrl(window.location.search))
    qc.removeQueries({ queryKey: ['me'] })
    return null
  })
  return <Navigate to={`/pocs/${LAB_POC}/experiences/${LAB_EXP}`} replace />
}
