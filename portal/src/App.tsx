import { useEffect, useState, type FormEvent } from "react";
import { consumeOAuthReturn, startGitHubLogin, submitContribution } from "./github.js";
import { validateEntity, type Entity } from "./entity.js";

type SubmissionKind = "addition" | "correction";
type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; url: string; branch: string };

interface Draft {
  id: string;
  englishName: string;
  localName: string;
  entityType: Entity["entity_type"];
  subdivisionCode: string;
  cityId: string;
  latitude: string;
  longitude: string;
  website: string;
  externalIdSystem: string;
  externalIdValue: string;
}

const initialDraft: Draft = {
  id: "",
  englishName: "",
  localName: "",
  entityType: "university",
  subdivisionCode: "BD-C",
  cityId: "wikidata:Q1354",
  latitude: "",
  longitude: "",
  website: "",
  externalIdSystem: "",
  externalIdValue: "",
};

const entityTypes: Array<{ value: Entity["entity_type"]; label: string }> = [
  { value: "school", label: "School" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "corporation", label: "Corporation" },
  { value: "civic_organization", label: "Civic organization" },
  { value: "religious_building", label: "Religious building" },
  { value: "other", label: "Other" },
];

function isSubmissionKind(value: string): value is SubmissionKind {
  return value === "addition" || value === "correction";
}

function isEntityType(value: string): value is Entity["entity_type"] {
  return entityTypes.some((option) => option.value === value);
}

function buildEntity(draft: Draft): Entity {
  const entity: Entity = {
    id: draft.id.trim(),
    names: {
      en: draft.englishName.trim(),
      local: draft.localName.trim(),
    },
    entity_type: draft.entityType,
    country_code: "BD",
    ...(draft.subdivisionCode.trim()
      ? { subdivision_code: draft.subdivisionCode.trim() }
      : {}),
    ...(draft.cityId.trim() ? { city_id: draft.cityId.trim() } : {}),
    ...(draft.latitude.trim() && draft.longitude.trim()
      ? {
          coordinates: {
            latitude: Number(draft.latitude),
            longitude: Number(draft.longitude),
          },
        }
      : {}),
    ...(draft.website.trim() ? { website: draft.website.trim() } : {}),
    ...(draft.externalIdSystem.trim() && draft.externalIdValue.trim()
      ? {
          external_ids: [
            {
              system: draft.externalIdSystem.trim(),
              value: draft.externalIdValue.trim(),
            },
          ],
        }
      : {}),
  };
  return entity;
}

export function App() {
  const [session, setSession] = useState<string>();
  const [login, setLogin] = useState<string>();
  const [authError, setAuthError] = useState<string>();
  const [kind, setKind] = useState<SubmissionKind>("addition");
  const [draft, setDraft] = useState(initialDraft);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });

  useEffect(() => {
    const result = consumeOAuthReturn();
    if (result?.status === "authenticated") {
      setSession(result.session);
      setLogin(result.login);
    } else if (result?.status === "error") {
      setAuthError(result.message);
    }
  }, []);

  function updateDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setSubmission({ status: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session) {
      setSubmission({ status: "error", message: "Sign in with GitHub before submitting." });
      return;
    }
    if (Boolean(draft.latitude.trim()) !== Boolean(draft.longitude.trim())) {
      setSubmission({
        status: "error",
        message: "Enter both latitude and longitude, or leave both blank.",
      });
      return;
    }
    if (Boolean(draft.externalIdSystem.trim()) !== Boolean(draft.externalIdValue.trim())) {
      setSubmission({
        status: "error",
        message: "Enter both an external ID system and value, or leave both blank.",
      });
      return;
    }

    const validation = validateEntity(buildEntity(draft));
    if (!validation.ok) {
      setSubmission({ status: "error", message: validation.errors.join("; ") });
      return;
    }

    setSubmission({ status: "submitting" });
    try {
      const result = await submitContribution(session, kind, validation.entity);
      setSubmission({ status: "success", url: result.html_url, branch: result.branch });
    } catch (error) {
      setSubmission({
        status: "error",
        message: error instanceof Error ? error.message : "The contribution could not be submitted.",
      });
    }
  }

  function signOut(): void {
    setSession(undefined);
    setLogin(undefined);
    setSubmission({ status: "idle" });
  }

  return (
    <main className="page-shell">
      <header className="masthead">
        <p className="eyebrow">Community data contribution</p>
        <h1>Help improve the Bangladesh directory</h1>
        <p className="lede">
          Suggest a new institution or a correction. Every submission is validated, reviewed, and
          proposed in a pull request before it can enter the published data.
        </p>
      </header>

      <section className="contributor-panel" aria-labelledby="github-heading">
        <div>
          <h2 id="github-heading">GitHub account</h2>
          <p>
            {login
              ? `Signed in as ${login}. Your session is held in memory and expires automatically.`
              : "Sign in to open a pull request in the RefDataKit repository."}
          </p>
        </div>
        {session ? (
          <button className="button button-secondary" type="button" onClick={signOut}>
            Sign out
          </button>
        ) : (
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              try {
                startGitHubLogin();
              } catch (error) {
                setAuthError(
                  error instanceof Error ? error.message : "GitHub sign-in is unavailable.",
                );
              }
            }}
          >
            Continue with GitHub
          </button>
        )}
        {authError ? <p className="message message-error" role="alert">{authError}</p> : null}
      </section>

      <form className="contribution-form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Submission details</legend>
          <div className="form-grid">
            <label>
              <span>Submission type</span>
              <select
                value={kind}
                onChange={(event) => {
                  if (isSubmissionKind(event.target.value)) {
                    setKind(event.target.value);
                  }
                }}
              >
                <option value="addition">Add a new institution</option>
                <option value="correction">Suggest a correction</option>
              </select>
            </label>
            <label>
              <span>Stable entity ID</span>
              <input
                required
                pattern="[A-Za-z0-9][A-Za-z0-9._:-]*"
                value={draft.id}
                onChange={(event) => updateDraft("id", event.target.value)}
                placeholder="wikidata:Q12345"
                autoComplete="off"
              />
            </label>
            <label>
              <span>English name</span>
              <input
                required
                value={draft.englishName}
                onChange={(event) => updateDraft("englishName", event.target.value)}
                autoComplete="organization"
              />
            </label>
            <label>
              <span>Local name (Bengali)</span>
              <input
                required
                lang="bn"
                value={draft.localName}
                onChange={(event) => updateDraft("localName", event.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              <span>Entity type</span>
              <select
                value={draft.entityType}
                onChange={(event) => {
                  if (isEntityType(event.target.value)) {
                    updateDraft("entityType", event.target.value);
                  }
                }}
              >
                {entityTypes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Country</span>
              <input value="Bangladesh (BD)" readOnly />
            </label>
            <label>
              <span>Subdivision code (optional)</span>
              <input
                value={draft.subdivisionCode}
                onChange={(event) => updateDraft("subdivisionCode", event.target.value)}
                placeholder="BD-C"
              />
            </label>
            <label>
              <span>City ID (optional)</span>
              <input
                value={draft.cityId}
                onChange={(event) => updateDraft("cityId", event.target.value)}
                placeholder="wikidata:Q1354"
              />
            </label>
            <label>
              <span>Latitude (optional)</span>
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={draft.latitude}
                onChange={(event) => updateDraft("latitude", event.target.value)}
              />
            </label>
            <label>
              <span>Longitude (optional)</span>
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={draft.longitude}
                onChange={(event) => updateDraft("longitude", event.target.value)}
              />
            </label>
            <label>
              <span>Website (optional)</span>
              <input
                type="url"
                value={draft.website}
                onChange={(event) => updateDraft("website", event.target.value)}
                placeholder="https://example.edu.bd"
              />
            </label>
            <label>
              <span>External ID system (optional)</span>
              <input
                value={draft.externalIdSystem}
                onChange={(event) => updateDraft("externalIdSystem", event.target.value)}
                placeholder="wikidata"
              />
            </label>
            <label>
              <span>External ID value (optional)</span>
              <input
                value={draft.externalIdValue}
                onChange={(event) => updateDraft("externalIdValue", event.target.value)}
                placeholder="Q12345"
              />
            </label>
          </div>
        </fieldset>

        <p className="privacy-note">
          Do not enter street addresses, personal contact details, or other sensitive information.
          Coordinates and stable city or external IDs are preferred.
        </p>

        <div className="submit-row">
          <button
            className="button button-primary"
            type="submit"
            disabled={!session || submission.status === "submitting"}
          >
            {submission.status === "submitting" ? "Submitting…" : "Validate and open pull request"}
          </button>
          <p className="submit-hint">
            {session ? "The pull request will be reviewed before publication." : "Sign in to enable submission."}
          </p>
        </div>

        {submission.status === "error" ? (
          <p className="message message-error" role="alert">{submission.message}</p>
        ) : null}
        {submission.status === "success" ? (
          <p className="message message-success" role="status">
            Pull request created for branch <code>{submission.branch}</code>.{" "}
            <a href={submission.url} target="_blank" rel="noreferrer">Review it on GitHub</a>.
          </p>
        ) : null}
      </form>

      <footer className="site-footer">
        <p>Contributions are suggestions, not endorsements. Source and redistribution terms are reviewed before publication.</p>
      </footer>
    </main>
  );
}
