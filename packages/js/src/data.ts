import { readFile } from "node:fs/promises";
import { CountryCode } from "./generated/country-code.js";
import type { CityOrLocality as City } from "./generated/city.js";
import type { Country } from "./generated/country.js";
import type { UniversalDirectoryEntity as Entity } from "./generated/entity.js";
import type { AdministrativeSubdivision as Subdivision } from "./generated/subdivision.js";

async function readRecords<T>(relativePath: string): Promise<T[]> {
  try {
    const contents = await readFile(new URL(`./data/datasets/${relativePath}`, import.meta.url), "utf8");
    return JSON.parse(contents) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function countryPath(code: CountryCode, kind: "cities" | "institutions" | "subdivisions"): string {
  if (!Object.values(CountryCode).includes(code)) {
    throw new TypeError("countryCode must be a supported CountryCode");
  }
  return `${kind}/by-country/${code}.json`;
}

export function getCountries(): Promise<Country[]> {
  return readRecords<Country>("countries/data.json");
}

export async function getCountry(countryCode: CountryCode): Promise<Country | undefined> {
  return (await getCountries()).find(({ code }) => code === countryCode);
}

export function getCities(countryCode: CountryCode): Promise<City[]> {
  return readRecords<City>(countryPath(countryCode, "cities"));
}

export function getSubdivisions(countryCode: CountryCode): Promise<Subdivision[]> {
  return readRecords<Subdivision>(countryPath(countryCode, "subdivisions"));
}

export function getInstitutions(countryCode: CountryCode): Promise<Entity[]> {
  return readRecords<Entity>(countryPath(countryCode, "institutions"));
}
