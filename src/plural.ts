/** «1 foto», «3 fotos»: el plural correcto en vez de «foto(s)». */
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
