import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marque explicitement une route comme publique (aucun JWT, aucun rôle requis).
// Phase 1 : uniquement POST /auth/login et POST /auth/bootstrap.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
