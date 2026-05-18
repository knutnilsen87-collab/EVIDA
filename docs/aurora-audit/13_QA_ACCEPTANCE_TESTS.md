# QA and Acceptance Tests — Document Control + Stable Saksrom Progress

## Purpose

This QA plan verifies:

1. Document Control supports fast preview and bulk handling safely.
2. Saksrom remains visually stable while import/preparation progresses.
3. Copy and next actions are clear and non-conflicting.

## Manual QA checklist

### Saksrom progress

- [ ] Start import with many documents.
- [ ] Saksrom screen stays on the same layout during import.
- [ ] A compact progress component appears.
- [ ] Progress shows document count.
- [ ] Progress shows page count.
- [ ] Progress shows source count.
- [ ] Progress shows current phase.
- [ ] Progress shows ETA or "Estimerer tid …".
- [ ] "Next best action" says "Import pågår" while import runs.
- [ ] Chat input says "Saksrom åpnes når dokumentgrunnlaget er klart nok" while locked.
- [ ] Summary area shows placeholder while not ready.
- [ ] Preliminary summary is labeled "Foreløpig" when only partial sources exist.
- [ ] Final summary appears only when ready.
- [ ] No layout jump occurs when progress updates.

### Document Control preview

- [ ] Open Document Control with documents requiring review.
- [ ] First document opens automatically or clear empty state is shown.
- [ ] Clicking a queue item loads preview in the center pane.
- [ ] Preview pane never remains empty/black.
- [ ] Preview error state is understandable.
- [ ] Right decision panel updates when selected document changes.
- [ ] Decision panel explains why document needs control.
- [ ] Decision panel explains what action means.

### Bulk selection

- [ ] Each queue item has a checkbox.
- [ ] Selecting one or more documents shows bulk action bar.
- [ ] Bulk bar shows count of selected documents.
- [ ] Bulk actions change based on selected document statuses.
- [ ] Corrupt/import-failed documents cannot be bulk-marked as controlled.
- [ ] Bulk "mark as controlled" shows confirmation dialog.
- [ ] Confirmation explains content is not legally approved as true.
- [ ] Bulk action audit event is recorded.
- [ ] After bulk action, selected documents are removed or status-updated.
- [ ] Selection clears after bulk action.
- [ ] Next unresolved document is active.

### Copy

- [ ] UI does not say "bulk godkjenn".
- [ ] UI does not say "godkjenn som kilde" if it can be misread as legal approval.
- [ ] Primary terms are "Marker som kontrollert", "Bruk som kildegrunnlag", "Hold utenfor".
- [ ] The explanatory sentence is visible:
  - "Du godkjenner ikke innholdet som juridisk sant."
  - "Du bestemmer bare om dokumentet kan inngå i sakens kildegrunnlag."

## Playwright test suggestions

### Test: stable Saksrom progress

```ts
test("Saksrom keeps stable layout during import", async ({ page }) => {
  await page.goto("/");

  await createCaseWithLargeImport(page);

  await page.getByRole("link", { name: /Saksrom/i }).click();

  const saksromCard = page.getByTestId("saksrom-card");
  const initialBox = await saksromCard.boundingBox();

  await expect(page.getByTestId("case-preparation-progress")).toBeVisible();
  await expect(page.getByText(/Import pågår/i)).toBeVisible();
  await expect(page.getByText(/dokumenter/i)).toBeVisible();
  await expect(page.getByText(/sider/i)).toBeVisible();

  await page.waitForTimeout(3000);

  const laterBox = await saksromCard.boundingBox();
  expect(Math.abs((laterBox?.height ?? 0) - (initialBox?.height ?? 0))).toBeLessThan(80);
});
```

### Test: progress copy

```ts
test("next best action follows import state", async ({ page }) => {
  await page.goto("/");
  await startImport(page);

  await expect(page.getByTestId("next-best-action")).toContainText("Import pågår");
  await expect(page.getByTestId("saksrom-input")).toHaveAttribute(
    "placeholder",
    /Saksrom åpnes når dokumentgrunnlaget er klart nok/
  );
});
```

### Test: document preview opens in center pane

```ts
test("clicking document opens preview in center pane", async ({ page }) => {
  await page.goto("/");
  await openDocumentControl(page);

  await page.getByRole("button", { name: /IMG_HARD_0010_scan.jpg/i }).click();

  await expect(page.getByTestId("document-preview-pane")).toBeVisible();
  await expect(page.getByTestId("document-preview-pane")).toContainText("IMG_HARD_0010_scan.jpg");
});
```

### Test: bulk bar appears

```ts
test("bulk selection bar appears when documents are selected", async ({ page }) => {
  await page.goto("/");
  await openDocumentControl(page);

  await page.getByRole("checkbox", { name: /IMG_HARD_0010_scan.jpg/i }).check();
  await page.getByRole("checkbox", { name: /IMG_HARD_0009_scan.jpg/i }).check();

  await expect(page.getByTestId("bulk-selection-bar")).toBeVisible();
  await expect(page.getByTestId("bulk-selection-bar")).toContainText("2 dokumenter valgt");
});
```

### Test: bulk controlled requires confirmation

```ts
test("bulk mark controlled requires confirmation", async ({ page }) => {
  await page.goto("/");
  await openDocumentControl(page);

  await selectBulkControllableDocuments(page, 3);

  await page.getByRole("button", { name: /Marker valgte som kontrollert/i }).click();

  await expect(page.getByRole("dialog")).toContainText("Marker 3 dokumenter som kontrollert");
  await expect(page.getByRole("dialog")).toContainText("Innholdet blir ikke vurdert som juridisk sant");

  await page.getByRole("checkbox", { name: /Jeg har kontrollert/i }).check();
  await page.getByRole("button", { name: /Marker 3 som kontrollert/i }).click();

  await expect(page.getByText(/3 dokumenter ble markert som kontrollert/i)).toBeVisible();
});
```

## Accessibility checks

### Progress

- [ ] Progress bar uses `role="progressbar"`.
- [ ] `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are present.
- [ ] Phase changes use `aria-live="polite"`.
- [ ] Progress updates do not spam screen readers.

### Document Control

- [ ] Queue is keyboard navigable.
- [ ] Checkboxes have accessible names.
- [ ] Preview pane has heading connected to selected document.
- [ ] Decision panel has clear heading.
- [ ] Bulk confirmation dialog traps focus.
- [ ] Escape closes dialog.
- [ ] Focus returns to previous control after dialog closes.
- [ ] Button focus states are visible.

## Regression risks

### Risk: Progress numbers disagree across screens

Mitigation:

- Use one `CasePreparationProgress` source of truth.

### Risk: Bulk action allows unsafe documents

Mitigation:

- Derive allowed bulk actions from selected statuses.
- Add unit tests for `getAllowedBulkActions`.

### Risk: User thinks "mark controlled" means legal approval

Mitigation:

- Use explanatory copy.
- Avoid "godkjenn".
- Require confirmation checkbox for bulk source inclusion.

### Risk: Layout shifts during import

Mitigation:

- Fixed progress component height.
- Stable summary container.
- No large conditional screen swaps.

## Unit tests

Test `getAllowedBulkActions`:

```ts
describe("getAllowedBulkActions", () => {
  it("allows OCR for OCR-needed documents", () => {
    expect(getAllowedBulkActions([
      { status: "needs_ocr", previewAvailable: true },
      { status: "needs_ocr", previewAvailable: true },
    ])).toContain("run_ocr_for_selected");
  });

  it("does not allow mark controlled for corrupt documents", () => {
    expect(getAllowedBulkActions([
      { status: "corrupt", previewAvailable: false },
    ])).not.toContain("mark_selected_controlled");
  });
});
```

Test next best action:

```ts
describe("getNextBestAction", () => {
  it("returns import running while import runs", () => {
    const action = getNextBestAction({
      state: "import_running",
      processedDocuments: 10,
      totalDocuments: 100,
      reviewRequiredCount: 0,
      saksromScope: "locked",
    } as CasePreparationProgress);

    expect(action.label).toBe("Import pågår");
  });

  it("returns control documents when review is required", () => {
    const action = getNextBestAction({
      state: "review_required",
      reviewRequiredCount: 26,
      saksromScope: "controlled_sources_only",
    } as CasePreparationProgress);

    expect(action.label).toBe("Kontroller dokumenter");
  });
});
```

## Release gate

Do not mark this UX flow complete until:

- [ ] Stable progress works during large import.
- [ ] Document Control preview works on click.
- [ ] Bulk selection works.
- [ ] Bulk source inclusion has confirmation.
- [ ] Copy avoids legal ambiguity.
- [ ] Accessibility checks pass.
- [ ] No contradictory "next best action" appears.
