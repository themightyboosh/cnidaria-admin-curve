import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { environment } from '../config/environments'

export interface FirebaseServices {
  app: FirebaseApp | null
  auth: Auth | null
  db: Firestore | null
  provider: GoogleAuthProvider | null
  isConfigured: boolean
}

const cfgFor = (env: string) => {
  // Use per-environment Vite env vars to avoid committing secrets
  const prefix = env === 'production' ? 'PROD' : env === 'staging' ? 'STAGE' : 'DEV'
  const read = (k: string) => (import.meta as any).env[`VITE_FIREBASE_${prefix}_${k}`]
  const config = {
    apiKey: read('API_KEY'),
    authDomain: read('AUTH_DOMAIN'),
    projectId: read('PROJECT_ID'),
    storageBucket: read('STORAGE_BUCKET'),
    messagingSenderId: read('MESSAGING_SENDER_ID'),
    appId: read('APP_ID')
  }
  const isConfigured = Object.values(config).every(Boolean)
  return { config, isConfigured }
}

let services: FirebaseServices | null = null

export const getFirebase = async (): Promise<FirebaseServices> => {
  if (services) return services
  const { config, isConfigured } = cfgFor(environment)
  if (!isConfigured) {
    console.warn('Firebase config missing for environment:', environment)
    services = { app: null, auth: null, db: null, provider: null, isConfigured: false }
    return services
  }

  const app = initializeApp(config)
  const auth = getAuth(app)
  await setPersistence(auth, browserLocalPersistence)
  const db = getFirestore(app)
  const provider = new GoogleAuthProvider()
  services = { app, auth, db, provider, isConfigured: true }
  return services
}


