.DEFAULT_GOAL := help

.PHONY: help setup run dev build preview check test test-audio test-browser test-all browsers budget data-download data-extract data-verify data-validate

help:
	@echo "make setup          Install Node dependencies"
	@echo "make run            Start the local development server"
	@echo "make check          Run typecheck, lint, unit/data checks, and build"
	@echo "make test-audio     Run Web Audio tests (requires Chromium)"
	@echo "make test-browser   Run browser tests (requires installed Playwright browsers)"
	@echo "make test-all       Run all automated checks"
	@echo "make browsers       Install Chromium, Firefox, and WebKit for Playwright"
	@echo "make build          Build the production site"
	@echo "make preview        Preview the production build"
	@echo "make budget         Measure production size budgets after building"
	@echo "make data-download Download and verify MaleCNS source data"
	@echo "make data-extract   Regenerate the whole-connectome assets"
	@echo "make data-verify    Verify the export against upstream source data"
	@echo "make data-validate  Validate the committed connectome data"

setup:
	npm ci

run dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

check:
	npm run check

test:
	npm run test

test-audio:
	npm run test:audio

test-browser:
	npm run test:browser

test-all:
	npm run test:all

browsers:
	npx playwright install chromium firefox webkit

budget:
	npm run budget

data-download:
	npm run data:download

data-extract:
	npm run data:extract

data-verify:
	npm run data:verify

data-validate:
	npm run data:validate
