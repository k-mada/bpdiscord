import { useState, useCallback } from "react";
import { apiService } from "../services/api";

export interface ActorPathActorStep {
  kind: "actor";
  tmdbId: number;
  name: string;
  profilePath: string | null;
}

export interface ActorPathFilmStep {
  kind: "film";
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
}

export type ActorPathStep = ActorPathActorStep | ActorPathFilmStep;

export interface ActorPath {
  degrees: number;
  fromActorId: number;
  toActorId: number;
  maxDepth: number;
  billingCutoff: number;
  path: ActorPathStep[];
}

export const useActorGraph = () => {
  const [path, setPath] = useState<ActorPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPath = useCallback(
    async (
      actor1TmdbId: number | string,
      actor2TmdbId: number | string
    ): Promise<ActorPath | null> => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.pathFinder(
          String(actor1TmdbId),
          String(actor2TmdbId)
        );
        const data = response.data as ActorPath | undefined;
        setPath(data ?? null);
        return data ?? null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to find actor path";
        setError(message);
        setPath(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setPath(null);
    setError(null);
  }, []);

  return { path, loading, error, getPath, reset };
};
