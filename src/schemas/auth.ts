import { z } from 'zod'

export const signInSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
})

export const signUpSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome completo'),
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  business_name: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine(
      (value) => !value || value.length >= 2,
      'Informe pelo menos 2 caracteres para o estabelecimento',
    )
    .refine(
      (value) => !value || value.length <= 100,
      'O nome do estabelecimento deve ter até 100 caracteres',
    ),
})

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do serviço'),
  description: z.string().trim().max(240).optional(),
  duration_minutes: z.coerce.number().int().min(15).max(480),
  price: z.coerce.number().min(0).max(100000),
})

export const businessSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento'),
})

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome completo').max(120),
  phone: z.string().trim().max(30).optional(),
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type SignUpFormInput = z.input<typeof signUpSchema>
export type ServiceValues = z.infer<typeof serviceSchema>
export type ServiceFormInput = z.input<typeof serviceSchema>
