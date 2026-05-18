import instance from "./http";

export interface SeriesDetails {
  id: number
  name: string
  slug: string
  image: string
  nameTranslations: string[]
  overviewTranslations: string[]
  aliases: string[]
  firstAired: string
  lastAired: string
  nextAired: string
  score: number
  status: Status
  originalCountry: string
  originalLanguage: string
  defaultSeasonType: number
  isOrderRandomized: boolean
  lastUpdated: string
  averageRuntime: number
  episodes: Episode[]
  overview: string
  year: string
  artworks: Artwork[]
  companies: Company[]
  originalNetwork: OriginalNetwork
  latestNetwork: LatestNetwork
  genres: Genre[]
  trailers: Trailer[]
  lists: List[]
  remoteIds: RemoteId[]
  characters: Character[]
  airsDays: AirsDays
  airsTime: any
  seasons: Season[]
  tags: Tag[]
  contentRatings: ContentRating[]
  seasonTypes: SeasonType[]
  language: string
  translations: Translations
}

export interface Status {
  id: number
  name: string
  recordType: string
  keepUpdated: boolean
}

export interface Episode {
  id: number
  seriesId: number
  name: string
  aired: string
  runtime: number
  nameTranslations: any
  overview?: string
  overviewTranslations: any
  image: string
  imageType: number
  isMovie: number
  seasons: any
  number: number
  seasonNumber: number
  lastUpdated: string
  finaleType?: string
  airsBeforeSeason?: number
  airsBeforeEpisode?: number
  year: string
}

export interface Artwork {
  id: number
  image: string
  thumbnail: string
  language?: string
  type: number
  score: number
  width: number
  height: number
  includesText: boolean
  thumbnailWidth: number
  thumbnailHeight: number
  updatedAt: number
  status: Status2
  tagOptions: any
  seasonId?: number
}

export interface Status2 {
  id: number
  name: any
}

export interface Company {
  id: number
  name: string
  slug: string
  nameTranslations: string[]
  overviewTranslations: any[]
  aliases: any[]
  country: string
  primaryCompanyType: number
  activeDate: any
  inactiveDate: any
  companyType: CompanyType
  parentCompany: ParentCompany
  tagOptions: any
}

export interface CompanyType {
  companyTypeId: number
  companyTypeName: string
}

export interface ParentCompany {
  id: any
  name: any
  relation: Relation
}

export interface Relation {
  id: any
  typeName: any
}

export interface OriginalNetwork {
  id: number
  name: string
  slug: string
  nameTranslations: string[]
  overviewTranslations: any[]
  aliases: any[]
  country: string
  primaryCompanyType: number
  activeDate: any
  inactiveDate: any
  companyType: CompanyType2
  parentCompany: ParentCompany2
  tagOptions: any
}

export interface CompanyType2 {
  companyTypeId: number
  companyTypeName: string
}

export interface ParentCompany2 {
  id: any
  name: any
  relation: Relation2
}

export interface Relation2 {
  id: any
  typeName: any
}

export interface LatestNetwork {
  id: number
  name: string
  slug: string
  nameTranslations: string[]
  overviewTranslations: any[]
  aliases: any[]
  country: string
  primaryCompanyType: number
  activeDate: any
  inactiveDate: any
  companyType: CompanyType3
  parentCompany: ParentCompany3
  tagOptions: any
}

export interface CompanyType3 {
  companyTypeId: number
  companyTypeName: string
}

export interface ParentCompany3 {
  id: any
  name: any
  relation: Relation3
}

export interface Relation3 {
  id: any
  typeName: any
}

export interface Genre {
  id: number
  name: string
  slug: string
}

export interface List {
  id: number
  name: string
  overview: string
  url: string
  isOfficial: boolean
  nameTranslations: string[]
  overviewTranslations: string[]
  aliases: Alias[]
  score: number
  image: string
  imageIsFallback: boolean
  remoteIds: any
  tags: any
}

export interface Alias {
  language: string
  name: string
}

export interface RemoteId {
  id: string
  type: number
  sourceName: string
}

export interface Character {
  id: number
  name: string
  peopleId: number
  seriesId: number
  series: any
  movie: any
  movieId: any
  episodeId: any
  type: number
  image: string
  sort: number
  isFeatured: boolean
  url: string
  nameTranslations: any
  overviewTranslations: any
  aliases: any
  peopleType: string
  personName: string
  tagOptions: any
  personImgURL: string
}

export interface AirsDays {
  sunday: boolean
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
}

export interface Season {
  id: number
  seriesId: number
  type: Type
  number: number
  nameTranslations: string[]
  overviewTranslations: string[]
  image?: string
  imageType?: number
  companies: Companies
  lastUpdated: string
  name?: string
}

export interface Type {
  id: number
  name: string
  type: string
  alternateName: any
}

export interface Companies {
  studio: any
  network: any
  production: any
  distributor: any
  special_effects: any
}

export interface Tag {
  id: number
  tag: number
  tagName: string
  name: string
  helpText: any
}

export interface ContentRating {
  id: number
  name: string
  country: string
  description: string
  contentType: string
  order: number
  fullname: any
}

export interface SeasonType {
  id: number
  name: string
  type: string
  alternateName: any
}

export interface Translations {
  name: string
  overview: string
  language: string
  aliases: string[]
}


export interface MovieDetails {
  id: number
  name: string
  slug: string
  image: string
  nameTranslations: string[]
  overviewTranslations: string[]
  aliases: any[]
  score: number
  runtime: number
  status: Status
  lastUpdated: string
  year: string
  trailers: Trailer[]
  genres: Genre[]
  releases: Release[]
  artworks: Artwork[]
  remoteIds: RemoteId[]
  characters: Character[]
  budget: string
  boxOffice: string
  boxOfficeUS: string
  originalCountry: string
  originalLanguage: string
  audioLanguages: any
  subtitleLanguages: any
  studios: any
  awards: any
  tagOptions: any
  lists: List[]
  contentRatings: any
  companies: Companies
  production_countries: ProductionCountry[]
  inspirations: any[]
  spoken_languages: string[]
  first_release: FirstRelease
}

export interface Status {
  id: number
  name: string
  recordType: string
  keepUpdated: boolean
}

export interface Trailer {
  id: number
  name: string
  url: string
  language: string
  runtime: number
}

export interface Genre {
  id: number
  name: string
  slug: string
}

export interface Release {
  country: string
  date: string
  detail: any
}

export interface Artwork {
  id: number
  image: string
  thumbnail: string
  language?: string
  type: number
  score: number
  width: number
  height: number
  includesText: boolean
}

export interface RemoteId {
  id: string
  type: number
  sourceName: string
}



export interface List {
  id: number
  name: string
  overview: string
  url: string
  isOfficial: boolean
  nameTranslations: string[]
  overviewTranslations: string[]
  aliases: Alias[]
  score: number
  image: string
  imageIsFallback: boolean
  remoteIds: any
  tags: any
}

export interface Alias {
  language: string
  name: string
}


export interface Production {
  id: number
  name: string
  slug: string
  nameTranslations: any
  overviewTranslations: any
  aliases: any
  country: any
  primaryCompanyType: number
  activeDate: any
  inactiveDate: any
  companyType: CompanyType
  parentCompany: ParentCompany
  tagOptions: any
}

export interface CompanyType {
  companyTypeId: number
  companyTypeName: string
}

export interface ParentCompany {
  id: any
  name: any
  relation: Relation
}

export interface Relation {
  id: any
  typeName: any
}

export interface ProductionCountry {
  id: number
  country: string
  name: string
}

export interface FirstRelease {
  country: string
  date: string
  detail: any
}

export interface Trailer {
  id: number
  name: string
  url: string
  language: string
  runtime: number
}


export default {
  details: async (thetvdbod: string, type: string): Promise<SeriesDetails> => {
    const { data } = await instance.get(`/show/anidb/${type}/${thetvdbod}/details`);
    return data;
  }
}

