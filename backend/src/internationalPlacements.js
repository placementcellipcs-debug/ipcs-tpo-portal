const { normalizePlacementText } = require('./placementRecords');

const normalizeLocationText = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const EMPTY_LOCATION_VALUES = new Set(['', 'na', 'n a', 'not available', 'unknown', 'none', 'null', 'undefined'].map(normalizeLocationText));
const INDIA_COUNTRY_NAMES = new Set(['india', 'bharat', 'republic of india', 'in', 'ind'].map(normalizeLocationText));
const INDIAN_STATES_AND_UTS = [
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
  'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur',
  'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
  'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'andaman and nicobar islands',
  'chandigarh', 'dadra and nagar haveli and daman and diu', 'delhi', 'jammu and kashmir', 'ladakh',
  'lakshadweep', 'puducherry'
].map(normalizeLocationText);
const COMMON_INDIAN_CITIES = [
  'ahmedabad', 'amritsar', 'bengaluru', 'bangalore', 'bhopal', 'bhubaneswar', 'chandigarh', 'chennai',
  'coimbatore', 'delhi', 'ernakulam', 'faridabad', 'gurugram', 'gurgaon', 'guwahati', 'hyderabad',
  'indore', 'jaipur', 'kochi', 'calicut', 'kannur', 'kollam', 'kottayam', 'lucknow', 'ludhiana',
  'madurai', 'mangaluru', 'mangalore', 'mumbai', 'mysore', 'mysuru', 'nagpur', 'nashik', 'noida',
  'patna', 'pune', 'raipur', 'ranchi', 'salem', 'surat', 'thiruvananthapuram', 'trivandrum', 'thrissur',
  'vadodara', 'vijayawada', 'visakhapatnam', 'vizag'
].map(normalizeLocationText);
const INTERNATIONAL_HINTS = [
  'international', 'overseas', 'abroad', 'united states', 'usa', 'u s a', 'united kingdom', 'uk', 'u k',
  'uae', 'united arab emirates', 'dubai', 'abu dhabi', 'saudi arabia', 'qatar', 'kuwait', 'oman', 'bahrain',
  'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines', 'japan', 'south korea', 'korea',
  'china', 'hong kong', 'taiwan', 'australia', 'new zealand', 'canada', 'mexico', 'brazil', 'germany', 'france',
  'italy', 'spain', 'netherlands', 'ireland', 'switzerland', 'sweden', 'norway', 'denmark', 'finland', 'poland',
  'portugal', 'belgium', 'austria', 'south africa', 'kenya', 'nigeria', 'egypt', 'israel', 'turkey', 'turkiye',
  'sri lanka', 'nepal', 'bangladesh', 'pakistan', 'maldives', 'london', 'toronto', 'vancouver', 'calgary',
  'new york', 'san francisco', 'los angeles', 'seattle', 'chicago', 'boston', 'austin', 'dallas', 'houston',
  'miami', 'atlanta', 'sydney', 'melbourne', 'perth', 'auckland', 'wellington', 'berlin', 'munich', 'paris',
  'amsterdam', 'dublin', 'tokyo', 'osaka', 'seoul', 'riyadh', 'muscat', 'manama', 'sharjah', 'ajman',
  'california', 'texas', 'florida', 'new jersey', 'new south wales', 'victoria'
].map(normalizeLocationText);

const cleanLocation = value => {
  const text = String(value ?? '').trim();
  return EMPTY_LOCATION_VALUES.has(normalizeLocationText(text)) ? '' : text;
};

const includesLocationName = (value, names) => {
  const normalized = normalizeLocationText(value);
  if (!normalized) return false;
  return names.some(name => normalized === name || normalized.startsWith(`${name} `) || normalized.endsWith(` ${name}`) || normalized.includes(` ${name} `));
};

const isIndiaCountry = value => INDIA_COUNTRY_NAMES.has(normalizeLocationText(value));

const classifyPlacementLocation = ({ country = '', state = '', location = '' } = {}) => {
  const cleanCountry = cleanLocation(country);
  const cleanState = cleanLocation(state);
  const cleanGeneralLocation = cleanLocation(location);
  const normalizedState = normalizeLocationText(cleanState);
  const normalizedLocation = normalizeLocationText(cleanGeneralLocation);
  if (cleanCountry) {
    const countryParts = cleanCountry.split(/[,;/|]+/).map(part => part.trim()).filter(Boolean);
    if (countryParts.some(part => !isIndiaCountry(part))) return true;
    if (!cleanState) return false;
  }
  if (cleanState) {
    if (INDIAN_STATES_AND_UTS.includes(normalizedState) || includesLocationName(normalizedState, INDIAN_STATES_AND_UTS)
      || includesLocationName(normalizedState, COMMON_INDIAN_CITIES)) return false;
    if (normalizedState.split(' ').some(part => part === 'india' || part === 'bharat')) return false;
    return true;
  }
  if (!cleanGeneralLocation) return false;
  if (includesLocationName(normalizedLocation, ['international', 'overseas', 'abroad'].map(normalizeLocationText))) return true;
  if (normalizedLocation.split(' ').some(part => part === 'india' || part === 'bharat')) return false;
  if (includesLocationName(normalizedLocation, INTERNATIONAL_HINTS)) return true;
  if (includesLocationName(normalizedLocation, INDIAN_STATES_AND_UTS) || includesLocationName(normalizedLocation, COMMON_INDIAN_CITIES)) return false;
  return false;
};

const createPlacementLocationResolver = (getValue, cache = {}) => {
  const read = (source, aliases) => cleanLocation(getValue(source, aliases));
  const vacanciesByJobId = new Map();
  (cache.vacancies || []).forEach(item => {
    const jobId = normalizePlacementText(read(item, ['jobid', 'job id', 'id']));
    if (jobId && !vacanciesByJobId.has(jobId)) vacanciesByJobId.set(jobId, item);
  });
  const clientsByCompany = new Map();
  (cache.clients || []).forEach(item => {
    const company = normalizePlacementText(read(item, ['companyname', 'company']));
    if (company && !clientsByCompany.has(company)) clientsByCompany.set(company, item);
  });

  return row => {
    const direct = {
      country: read(row, ['placementcountry', 'workcountry', 'jobcountry', 'companycountry', 'country']),
      state: read(row, ['placementstate', 'workstate', 'jobstate', 'state']),
      location: read(row, ['placementlocation', 'worklocation', 'joblocation', 'location', 'city', 'companylocation'])
    };
    let source = direct;
    if (!direct.country && !direct.state && !direct.location) {
      const jobId = normalizePlacementText(read(row, ['jobid', 'job id', 'vacancyid']));
      const vacancy = jobId ? vacanciesByJobId.get(jobId) : null;
      if (vacancy) {
        source = {
          country: read(vacancy, ['country', 'companycountry']),
          state: read(vacancy, ['state', 'placementstate']),
          location: read(vacancy, ['location', 'openingat(location)', 'worklocation'])
        };
      }
      if (!source.country && !source.state && !source.location) {
        const companyKey = normalizePlacementText(read(row, ['companyname', 'company']));
        const client = companyKey ? clientsByCompany.get(companyKey) : null;
        if (client) source = {
          country: read(client, ['companycountry', 'country']),
          state: read(client, ['companystate', 'state']),
          location: read(client, ['companylocation', 'location'])
        };
      }
    }
    const location = [source.location, source.state, source.country].filter(Boolean).join(', ');
    return {
      location,
      country: source.country,
      state: source.state,
      isInternationalPlacement: classifyPlacementLocation(source)
    };
  };
};

const getPlacementLocationInfo = (row, getValue, cache = {}) => createPlacementLocationResolver(getValue, cache)(row);

module.exports = { classifyPlacementLocation, createPlacementLocationResolver, getPlacementLocationInfo };
