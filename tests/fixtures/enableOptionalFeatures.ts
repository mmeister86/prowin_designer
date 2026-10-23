import { OPTIONAL_FEATURES } from '../../shared/prowin/features.ts'

// Only preloaded by the legacy integration tests, never by the application.
Object.assign(OPTIONAL_FEATURES, { metaAds: true, refero: true, backgrounds: true, automations: true })
