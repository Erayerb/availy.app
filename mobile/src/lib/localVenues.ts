/**
 * v1 let a business add its venue only on its phone, with ids from LOCAL_ID_START up. Those venues
 * are not on the server; such a business is sent to choose its venue again.
 */
export const LOCAL_ID_START = 100_001;

export const isLocalVenueId = (id: number) => id >= LOCAL_ID_START;
