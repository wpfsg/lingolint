import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header.js';
import { ResultsScreen } from './components/ResultsScreen.js';
import { UploadScreen } from './components/UploadScreen.js';
import { loadExampleProject } from './lib/example.js';
import {
  guessSourceLocale,
  readLocaleFile,
  FileLoadError,
  type LoadedLocale,
} from './lib/files.js';
import { emptyReviewState, type ReviewState } from './lib/review.js';
import { applyTheme, nextTheme, readTheme, type Theme } from './lib/theme.js';

export function App() {
  const [locales, setLocales] = useState<LoadedLocale[]>([]);
  const [sourceLocale, setSourceLocale] = useState<string | undefined>();
  const [activeTarget, setActiveTarget] = useState<string | undefined>();
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // `?example` opens the bundled demo project directly (handy for demos and screenshots).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('example')) {
      const example = loadExampleProject();
      setLocales(example);
      setSourceLocale('en');
    }
  }, []);

  const targets = useMemo(
    () => locales.filter((l) => l.locale !== sourceLocale).map((l) => l.locale),
    [locales, sourceLocale],
  );

  useEffect(() => {
    if (activeTarget === undefined || !targets.includes(activeTarget)) {
      setActiveTarget(targets[0]);
    }
  }, [targets, activeTarget]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const loaded: LoadedLocale[] = [];
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      try {
        loaded.push(await readLocaleFile(file));
      } catch (error) {
        failures.push(
          error instanceof FileLoadError
            ? `${error.fileName}: ${error.message}`
            : `${file.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    setErrors(failures);
    if (loaded.length > 0) {
      setLocales((current) => {
        const byLocale = new Map(current.map((l) => [l.locale, l]));
        for (const item of loaded) {
          byLocale.set(item.locale, item);
        }
        const next = Array.from(byLocale.values());
        setSourceLocale((existing) => existing ?? guessSourceLocale(next));
        return next;
      });
      setReviews((current) => {
        const next = { ...current };
        for (const item of loaded) {
          Reflect.deleteProperty(next, item.locale);
        }
        return next;
      });
    }
  }, []);

  const loadExample = useCallback(() => {
    const example = loadExampleProject();
    setLocales(example);
    setSourceLocale('en');
    setReviews({});
    setErrors([]);
  }, []);

  const reset = useCallback(() => {
    setLocales([]);
    setSourceLocale(undefined);
    setActiveTarget(undefined);
    setReviews({});
    setErrors([]);
  }, []);

  const removeLocale = useCallback((locale: string) => {
    setLocales((current) => current.filter((l) => l.locale !== locale));
    setReviews((current) => {
      const next = { ...current };
      Reflect.deleteProperty(next, locale);
      return next;
    });
    setSourceLocale((current) => (current === locale ? undefined : current));
  }, []);

  const source = locales.find((l) => l.locale === sourceLocale);
  const target = locales.find((l) => l.locale === activeTarget);
  const ready = source !== undefined && target !== undefined;

  return (
    <div className="app">
      <Header
        theme={theme}
        onToggleTheme={() => {
          setTheme(nextTheme(theme));
        }}
        onReset={locales.length > 0 ? reset : undefined}
      />
      {ready ? (
        <ResultsScreen
          source={source}
          target={target}
          targets={targets}
          locales={locales}
          onSelectTarget={setActiveTarget}
          onSelectSource={setSourceLocale}
          review={reviews[target.locale] ?? emptyReviewState}
          onReviewChange={(state) => {
            setReviews((current) => ({ ...current, [target.locale]: state }));
          }}
          onAddFiles={(files) => {
            void addFiles(files);
          }}
        />
      ) : (
        <UploadScreen
          locales={locales}
          sourceLocale={sourceLocale}
          errors={errors}
          onAddFiles={(files) => {
            void addFiles(files);
          }}
          onSelectSource={setSourceLocale}
          onRemoveLocale={removeLocale}
          onLoadExample={loadExample}
        />
      )}
    </div>
  );
}
