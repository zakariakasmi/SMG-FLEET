import { z } from 'zod'

// Vehicle validation schema
export const vehicleSchema = z.object({
  code: z
    .string()
    .min(1, 'Le code est requis')
    .max(50, 'Le code ne doit pas dépasser 50 caractères')
    .regex(/^[A-Z0-9]+$/, 'Le code doit contenir uniquement des lettres majuscules et des chiffres'),
  registration_plate: z
    .string()
    .min(1, 'La plaque d\'immatriculation est requise')
    .max(50, 'La plaque ne doit pas dépasser 50 caractères'),
  ww_plate: z
    .string()
    .max(50, 'La plaque WW ne doit pas dépasser 50 caractères')
    .optional()
    .or(z.literal('')),
  vehicle_type: z.string().min(1, 'Le type de véhicule est requis'),
  brand: z.string().min(1, 'La marque est requise'),
  fuel_type: z.string().min(1, 'Le type de carburant est requis'),
  purchase_date: z.string().optional().or(z.literal('')),
  puissance_fiscale: z.union([z.number(), z.string()]).optional(),
  ptac: z.union([z.number(), z.string()]).optional(),
    category_id: z.union([z.number().min(1), z.string().min(1, 'La catégorie est requise')]),
  status: z.enum(['active', 'sold']),
  notes: z.string().optional(),
})

// Charge validation schema
export const chargeSchema = z.object({
  vehicle_id: z.union([z.number().min(1), z.string().min(1, 'Le véhicule est requis')]),
  charge_type_id: z.union([z.number().min(1), z.string().min(1, 'Le type de charge est requis')]),
  amount: z.union([z.number().min(0.01), z.string().min(1, 'Le montant est requis')]),
  notes: z.string().optional(),
})

// Category validation schema
export const categorySchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom ne doit pas dépasser 255 caractères'),
  description: z.string().optional(),
})

// Helper function to validate purchase date format
export function validatePurchaseDate(dateString: string): boolean {
  // Try multiple formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
  ]

  if (!formats.some((f) => f.test(dateString))) {
    return false
  }

  const date = new Date(dateString.replace(/\//g, '-'))
  return !isNaN(date.getTime()) && date <= new Date()
}

// Helper function to validate amount
export function validateAmount(value: string | number): boolean {
  const num = Number(value)
  return !isNaN(num) && num > 0
}

// Helper function to validate vehicle code format
export function validateVehicleCode(code: string): boolean {
  return /^[A-Z0-9]+$/.test(code) && code.length <= 50
}