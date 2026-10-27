/** "★★★★☆" for a 1–5 rating. */
export const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);
