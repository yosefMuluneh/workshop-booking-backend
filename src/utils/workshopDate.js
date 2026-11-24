// Workshop dates are calendar dates for the business, not event timestamps.
// The booking operation and public listing must use the same business timezone.
const BUSINESS_TIME_ZONE = 'Africa/Addis_Ababa';
const BUSINESS_UTC_OFFSET = '+03:00';

const getBusinessDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const getStartOfBusinessDay = (date = new Date()) => {
  const dateKey = getBusinessDateKey(date);
  return new Date(`${dateKey}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
};

const isPastWorkshopDate = (workshopDate, now = new Date()) =>
  new Date(workshopDate) < getStartOfBusinessDay(now);

module.exports = {
  BUSINESS_TIME_ZONE,
  getBusinessDateKey,
  getStartOfBusinessDay,
  isPastWorkshopDate,
};
