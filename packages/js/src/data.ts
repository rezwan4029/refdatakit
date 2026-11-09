import { readFile } from "node:fs/promises";
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

function countryPath(code: string, kind: "cities" | "institutions" | "subdivisions"): string {
  if (!/^[A-Z]{2}$/.test(code)) throw new TypeError("countryCode must be an ISO alpha-2 code");
  return `${kind}/by-country/${code}.json`;
}

export function getCountries(): Promise<Country[]> {
  return readRecords<Country>("countries/data.json");
}

export async function getCountry(countryCode: string): Promise<Country | undefined> {
  return (await getCountries()).find(({ code }) => code === countryCode);
}

export function getCities(countryCode: string): Promise<City[]> {
  return readRecords<City>(countryPath(countryCode, "cities"));
}

export function getSubdivisions(countryCode: string): Promise<Subdivision[]> {
  return readRecords<Subdivision>(countryPath(countryCode, "subdivisions"));
}

export function getInstitutions(countryCode: string): Promise<Entity[]> {
  return readRecords<Entity>(countryPath(countryCode, "institutions"));
}
