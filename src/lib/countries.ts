// Which countries a story is about, found by name, demonym, capital or a well-known stand-in
// ("the Kremlin", "Beijing"). Used by the article page to fly the globe to each one.

export interface Place {
  /** ISO 3166-1 alpha-2, also the flag file name. 'EU' is the European Union (a group of countries). */
  code: string
  name: string
  /** ISO 3166-1 numeric ids in the world atlas (the EU lists its member states) */
  ids: string[]
  pattern: RegExp
}

// Patterns are case-sensitive on purpose: proper nouns only, so "china" in "fine china" is unlikely and "US" ≠ "us".
const P = (code: string, id: string, name: string, pattern: RegExp): Place => ({ code, name, ids: [id], pattern })

const EU_MEMBERS = ['040', '056', '100', '191', '196', '203', '208', '233', '246', '250', '276', '300', '348', '372', '380', '428', '440', '442', '470', '528', '616', '620', '642', '703', '705', '724', '752']

export const PLACES: Place[] = [
  P('US', '840', 'United States', /\b(United States|U\.S\.A?\.?|USA|US(?=[\s,.;:'’)-])|(?<!(?:Latin|South|North|Central) )America(?!s)|American(?!s? (?:Samoa|Express))|Americans|Washington(?! Post| state)|White House|Pentagon|Trump administration|Biden administration|Wall Street)\b/),
  P('CN', '156', 'China', /\b(China|Chinese|Beijing|Xi Jinping)\b/),
  P('RU', '643', 'Russia', /\b(Russia|Russian|Russians|Moscow|Kremlin|Putin)\b/),
  P('UA', '804', 'Ukraine', /\b(Ukraine|Ukrainian|Ukrainians|Kyiv|Kiev|Zelensky[iy]?)\b/),
  P('GB', '826', 'United Kingdom', /\b(United Kingdom|U\.K\.|UK|Britain|British|England|Scotland|Wales|Downing Street|Bank of England)\b/),
  P('FR', '250', 'France', /\b(France|French|Paris|Macron|Élysée|Elysee)\b/),
  P('DE', '276', 'Germany', /\b(Germany|German|Germans|Berlin|Bundesbank)\b/),
  P('IT', '380', 'Italy', /\b(Italy|Italian|Italians|Rome)\b/),
  P('ES', '724', 'Spain', /\b(Spain|Spanish|Madrid)\b/),
  P('PT', '620', 'Portugal', /\b(Portugal|Portuguese|Lisbon)\b/),
  P('NL', '528', 'Netherlands', /\b(Netherlands|Dutch|Amsterdam|The Hague)\b/),
  P('BE', '056', 'Belgium', /\b(Belgium|Belgian)\b/),
  P('CH', '756', 'Switzerland', /\b(Switzerland|Swiss|Geneva|Zurich|Bern)\b/),
  P('AT', '040', 'Austria', /\b(Austria|Austrian|Vienna)\b/),
  P('PL', '616', 'Poland', /\b(Poland|Polish|Warsaw)\b/),
  P('SE', '752', 'Sweden', /\b(Sweden|Swedish|Stockholm)\b/),
  P('NO', '578', 'Norway', /\b(Norway|Norwegian|Oslo)\b/),
  P('FI', '246', 'Finland', /\b(Finland|Finnish|Helsinki)\b/),
  P('DK', '208', 'Denmark', /\b(Denmark|Danish|Copenhagen)\b/),
  P('IE', '372', 'Ireland', /\b(Ireland|Irish|Dublin)\b/),
  P('GR', '300', 'Greece', /\b(Greece|Greek|Athens)\b/),
  P('HU', '348', 'Hungary', /\b(Hungary|Hungarian|Budapest|Orbán|Orban)\b/),
  P('CZ', '203', 'Czechia', /\b(Czechia|Czech Republic|Czech|Prague)\b/),
  P('RO', '642', 'Romania', /\b(Romania|Romanian|Bucharest)\b/),
  P('RS', '688', 'Serbia', /\b(Serbia|Serbian|Belgrade)\b/),
  P('BY', '112', 'Belarus', /\b(Belarus|Belarusian|Minsk|Lukashenko)\b/),
  P('MD', '498', 'Moldova', /\b(Moldova|Moldovan)\b/),
  P('GE', '268', 'Georgia', /\b(Tbilisi|Georgian government|Georgia's (?:government|prime minister|president))\b/),
  P('AM', '051', 'Armenia', /\b(Armenia|Armenian|Yerevan)\b/),
  P('AZ', '031', 'Azerbaijan', /\b(Azerbaijan|Azerbaijani|Baku)\b/),
  P('TR', '792', 'Turkey', /\b(Turkey(?!s\b)|Türkiye|Turkish|Ankara|Istanbul|Erdoğan|Erdogan)\b/),
  P('IL', '376', 'Israel', /\b(Israel|Israeli|Israelis|Netanyahu|Jerusalem|Tel Aviv|IDF)\b/),
  P('PS', '275', 'Palestine', /\b(Palestine|Palestinian|Palestinians|Gaza|West Bank|Hamas)\b/),
  P('LB', '422', 'Lebanon', /\b(Lebanon|Lebanese|Beirut|Hezbollah)\b/),
  P('SY', '760', 'Syria', /\b(Syria|Syrian|Syrians|Damascus)\b/),
  P('JO', '400', 'Jordan', /\b(Jordan(?!ian)|Jordanian|Amman)\b(?! (?:Peterson|Bardella|River))/),
  P('IQ', '368', 'Iraq', /\b(Iraq|Iraqi|Baghdad)\b/),
  P('IR', '364', 'Iran', /\b(Iran|Iranian|Iranians|Tehran)\b/),
  P('SA', '682', 'Saudi Arabia', /\b(Saudi Arabia|Saudi|Saudis|Riyadh)\b/),
  P('AE', '784', 'United Arab Emirates', /\b(United Arab Emirates|UAE|Emirati|Abu Dhabi|Dubai)\b/),
  P('QA', '634', 'Qatar', /\b(Qatar|Qatari|Doha)\b/),
  P('KW', '414', 'Kuwait', /\b(Kuwait|Kuwaiti)\b/),
  P('OM', '512', 'Oman', /\b(Oman|Omani|Muscat)\b/),
  P('YE', '887', 'Yemen', /\b(Yemen|Yemeni|Houthis?|Sanaa)\b/),
  P('EG', '818', 'Egypt', /\b(Egypt|Egyptian|Cairo|Suez)\b/),
  P('LY', '434', 'Libya', /\b(Libya|Libyan|Tripoli)\b/),
  P('DZ', '012', 'Algeria', /\b(Algeria|Algerian|Algiers)\b/),
  P('MA', '504', 'Morocco', /\b(Morocco|Moroccan|Rabat)\b/),
  P('TN', '788', 'Tunisia', /\b(Tunisia|Tunisian)\b/),
  P('SD', '729', 'Sudan', /\b(Sudan(?!ese)|Sudanese|Khartoum)\b/),
  P('SS', '728', 'South Sudan', /\b(South Sudan|Juba)\b/),
  P('ET', '231', 'Ethiopia', /\b(Ethiopia|Ethiopian|Addis Ababa)\b/),
  P('SO', '706', 'Somalia', /\b(Somalia|Somali|Mogadishu)\b/),
  P('KE', '404', 'Kenya', /\b(Kenya|Kenyan|Nairobi)\b/),
  P('NG', '566', 'Nigeria', /\b(Nigeria|Nigerian|Abuja|Lagos)\b/),
  P('GH', '288', 'Ghana', /\b(Ghana|Ghanaian|Accra)\b/),
  P('ZA', '710', 'South Africa', /\b(South Africa|South African|Pretoria|Johannesburg|Cape Town)\b/),
  P('CD', '180', 'DR Congo', /\b(Democratic Republic of (?:the )?Congo|DR Congo|DRC|Kinshasa)\b/),
  P('ML', '466', 'Mali', /\b(Mali|Malian|Bamako)\b/),
  P('NE', '562', 'Niger', /\b(Niger|Niamey)\b(?!ia)/),
  P('IN', '356', 'India', /\b(India|Indian|Indians|New Delhi|Delhi|Mumbai|Modi)\b(?! Ocean)/),
  P('PK', '586', 'Pakistan', /\b(Pakistan|Pakistani|Islamabad|Karachi)\b/),
  P('AF', '004', 'Afghanistan', /\b(Afghanistan|Afghan|Kabul|Taliban)\b/),
  P('BD', '050', 'Bangladesh', /\b(Bangladesh|Bangladeshi|Dhaka)\b/),
  P('LK', '144', 'Sri Lanka', /\b(Sri Lanka|Sri Lankan|Colombo)\b/),
  P('NP', '524', 'Nepal', /\b(Nepal|Nepali|Nepalese|Kathmandu)\b/),
  P('JP', '392', 'Japan', /\b(Japan|Japanese|Tokyo|Bank of Japan|BOJ)\b/),
  P('KR', '410', 'South Korea', /\b(South Korea|South Korean|Seoul)\b/),
  P('KP', '408', 'North Korea', /\b(North Korea|North Korean|Pyongyang|Kim Jong Un)\b/),
  P('TW', '158', 'Taiwan', /\b(Taiwan|Taiwanese|Taipei)\b/),
  P('HK', '344', 'Hong Kong', /\b(Hong Kong)\b/),
  P('MN', '496', 'Mongolia', /\b(Mongolia|Mongolian|Ulaanbaatar)\b/),
  P('ID', '360', 'Indonesia', /\b(Indonesia|Indonesian|Indonesians|Jakarta|Prabowo|Jokowi|rupiah|Bank Indonesia|Bali|Java|Sumatra)\b/),
  P('MY', '458', 'Malaysia', /\b(Malaysia|Malaysian|Kuala Lumpur)\b/),
  P('SG', '702', 'Singapore', /\b(Singapore|Singaporean)\b/),
  P('TH', '764', 'Thailand', /\b(Thailand|Thai|Bangkok)\b/),
  P('VN', '704', 'Vietnam', /\b(Vietnam|Viet Nam|Vietnamese|Hanoi|Ho Chi Minh City)\b/),
  P('PH', '608', 'Philippines', /\b(Philippines|Philippine|Filipino|Filipinos|Manila)\b/),
  P('MM', '104', 'Myanmar', /\b(Myanmar|Burma|Burmese|Naypyidaw|Yangon)\b/),
  P('KH', '116', 'Cambodia', /\b(Cambodia|Cambodian|Phnom Penh)\b/),
  P('AU', '036', 'Australia', /\b(Australia|Australian|Australians|Canberra|Sydney|Melbourne)\b/),
  P('NZ', '554', 'New Zealand', /\b(New Zealand|Wellington|Auckland)\b/),
  P('KZ', '398', 'Kazakhstan', /\b(Kazakhstan|Kazakh|Astana)\b/),
  P('CA', '124', 'Canada', /\b(Canada|Canadian|Canadians|Ottawa|Toronto|Bank of Canada)\b/),
  P('MX', '484', 'Mexico', /\b(Mexico|Mexican|Mexicans)\b(?! (?:City Open))/),
  P('BR', '076', 'Brazil', /\b(Brazil|Brazilian|Brasília|Brasilia|Lula|Petrobras)\b/),
  P('AR', '032', 'Argentina', /\b(Argentina|Argentine|Argentinian|Buenos Aires|Milei)\b/),
  P('CL', '152', 'Chile', /\b(Chile|Chilean|Santiago)\b/),
  P('CO', '170', 'Colombia', /\b(Colombia|Colombian|Bogotá|Bogota)\b/),
  P('PE', '604', 'Peru', /\b(Peru|Peruvian|Lima)\b/),
  P('VE', '862', 'Venezuela', /\b(Venezuela|Venezuelan|Caracas|Maduro)\b/),
  P('CU', '192', 'Cuba', /\b(Cuba|Cuban|Havana)\b/),
  P('PA', '591', 'Panama', /\b(Panama|Panamanian)\b/),
  P('GL', '304', 'Greenland', /\b(Greenland)\b/),
  { code: 'EU', name: 'European Union', ids: EU_MEMBERS, pattern: /\b(European Union|EU|European Commission|Brussels|ECB|European Central Bank|eurozone|euro zone)\b/ },
]

const PLACE_BY_CODE = new Map(PLACES.map((p) => [p.code, p]))
export const placeByCode = (code: string) => PLACE_BY_CODE.get(code)

/**
 * Companies and institutions that place a story in their home country when no country is named
 * ("Microsoft to rely more on homegrown AI chips" is a US story). Weighed lower than a country's own name,
 * so "Indonesia signs a deal with Microsoft" still leads with Indonesia.
 */
const ORGS: Record<string, RegExp> = {
  US: /\b(Microsoft|Apple|Google|Alphabet|Amazon(?! (?:rainforest|River|basin))|Meta|Facebook|Instagram|WhatsApp|Nvidia|Intel|AMD|Qualcomm|Broadcom|Micron|Tesla|SpaceX|OpenAI|Anthropic|xAI|IBM|Oracle|Salesforce|Netflix|Uber|Palantir|Waymo|Boeing|Ford|General Motors|GM|ExxonMobil|Exxon|Chevron|JPMorgan|Goldman Sachs|Morgan Stanley|BlackRock|Berkshire Hathaway|Walmart|Federal Reserve|the Fed|Powell|SEC|Nasdaq|S&P 500|Dow Jones|Boston Dynamics|Figure AI|Cisco|Dell|HP|Lockheed Martin|Raytheon|Pfizer|Moderna)\b/,
  CN: /\b(Huawei|Alibaba|Tencent|BYD|Baidu|ByteDance|Xiaomi|DeepSeek|SMIC|CATL|PBOC|People's Bank of China|Unitree|Lenovo|ZTE|JD\.com|Moonshot AI|Zhipu)\b/,
  TW: /\b(TSMC|Foxconn|Hon Hai|MediaTek|UMC)\b/,
  KR: /\b(Samsung|SK Hynix|Hyundai|Kia|LG Electronics|LG Energy|Bank of Korea|Naver|Kakao)\b/,
  JP: /\b(Toyota|Sony|SoftBank|Nintendo|Honda|Nissan|Panasonic|Fanuc|Tokyo Electron|Renesas|Mitsubishi|Nikkei)\b/,
  NL: /\b(ASML|NXP|Philips)\b/,
  GB: /\b(BP|Shell|Arm Holdings|DeepMind|HSBC|Barclays|Rolls-Royce|BAE Systems|AstraZeneca|FTSE)\b/,
  DE: /\b(Siemens|Volkswagen|BMW|Mercedes-Benz|SAP|Infineon|Bosch|Deutsche Bank|DAX)\b/,
  FR: /\b(Airbus|TotalEnergies|LVMH|Mistral AI|Renault|BNP Paribas|Dassault)\b/,
  CH: /\b(Nestlé|Nestle|UBS|ABB|Novartis|Roche|Glencore)\b/,
  DK: /\b(Novo Nordisk|Maersk)\b/,
  SE: /\b(Ericsson|Spotify|Volvo)\b/,
  FI: /\b(Nokia)\b/,
  RU: /\b(Gazprom|Rosneft|Lukoil|Rosatom)\b/,
  IN: /\b(Reliance Industries|Reliance|Tata|Infosys|Wipro|Adani|Reserve Bank of India|RBI)\b/,
  ID: /\b(Pertamina|Danantara|Telkom Indonesia|GoTo|Tokopedia|PLN|Freeport Indonesia|Vale Indonesia|IDX)\b/,
  SA: /\b(Aramco|PIF|NEOM)\b/,
  AE: /\b(ADNOC|Emirates airline|Mubadala|G42)\b/,
  IL: /\b(Mobileye|Mossad)\b/,
  BR: /\b(Vale|Embraer)\b/,
  CA: /\b(Shopify|Brookfield)\b/,
  AU: /\b(BHP|Rio Tinto)\b/,
}

const count = (re: RegExp, s: string) => (s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) ?? []).length
const firstIndex = (re: RegExp | undefined, s: string) => (re ? (new RegExp(re.source).exec(s)?.index ?? Infinity) : Infinity)

/**
 * Countries the story is about, most central first (max 4, so the tour stays short).
 * A place counts when the headline names it (or a company from there), or the body names it at least twice:
 * a single passing mention ("...like the US did last year") is usually not what the story is about.
 */
export function detectPlaces(title: string, body: string, max = 4): Place[] {
  const text = `${title} ${body}`
  const scored = PLACES.map((p) => {
    const org = ORGS[p.code]
    const inTitle = count(p.pattern, title)
    const inBody = count(p.pattern, body)
    const orgTitle = org ? count(org, title) : 0
    const orgBody = org ? count(org, body) : 0
    const qualifies = inTitle > 0 || inBody >= 2 || orgTitle > 0 || orgBody >= 3
    const first = Math.min(firstIndex(p.pattern, text), firstIndex(org, text))
    return { p, inTitle, qualifies, score: inTitle * 3 + inBody + orgTitle * 2 + orgBody * 0.5, first }
  }).filter((x) => x.qualifies)

  // The EU stands in for its members: when a member state is already on the tour, keep the EU only if the headline names it
  let list = scored.sort((a, b) => b.score - a.score || a.first - b.first)
  const hasMember = list.some((x) => x.p.code !== 'EU' && EU_MEMBERS.includes(x.p.ids[0]))
  if (hasMember) list = list.filter((x) => x.p.code !== 'EU' || x.inTitle > 0)
  return list.slice(0, max).map((x) => x.p)
}
