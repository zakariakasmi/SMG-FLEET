export { cn } from "cn"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (value) => EMAIL_RE.test(String(value || '').trim())
