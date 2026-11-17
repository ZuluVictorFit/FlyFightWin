# Program integrity

Source: approved 54-page eight-week PDF. SHA-256:
`7002aa857cedcc9ae05daaeb998b4e3e444c259af0ee51ec359f93b9f2e74cc4`.

- Six overview/progression pages retained in the master and available under Plan.
- 48 daily pages, each containing two athlete columns: **96 active athlete sessions**.
- Eight Sunday rest days per athlete: **112 total sessions**.
- **566 prescription rows**, including preparation, ramps, work and cooldowns.
- **2,830 source cells** independently reconciled: group, exercise, sets, reps/time, intensity/rest. Zero mismatches, missing cells or empty active sessions.

The generator uses PDF text-line coordinates and the sets column to identify row boundaries. This avoids the side-by-side column interleaving and wrapped WORK labels in the convenience text extraction. The independent audit uses pdfplumber/pdfminer word coordinates rather than the generator's PyMuPDF line output. The source image was inspected to confirm the table organization.

Runtime and automated checks cover complete week/day/athlete membership, stable exercise IDs, exact ordering, Lu raises, lower primer before jumps/heavy lifts, optional finishers, paired groups, yards for physical sleds/carries, simulated VOLTRA distances, all Tuesday interval doses and recoveries, and week 4/8 reduced set counts. Thursday strides are absent in reduced weeks as prescribed. Strength targets and logging slots are derived from this one master; no second workout renderer contains prescriptions.

Overview reconciliation: Monday top reps `[5,5,3,5,4,3,3,4]`; lower top reps `[3,4,3,4,3,3,2,3]`; alternating deadlift/squat patterns; Friday clean/jump, push press, slam/pull, sled and carry series; Tuesday interval/recovery series; Thursday and Saturday aerobic volumes all agree with daily pages. Athlete-specific exercises and recoveries remain separate.

Reproduce using private source PDF (not required to run the app):

```sh
python3 scripts/extract_program.py /private/path/FlyFightWin_8_Week_Athletic_Strength.pdf
python3 scripts/audit_pdf.py /private/path/FlyFightWin_8_Week_Athletic_Strength.pdf
```

Authoring dependencies: PyMuPDF and pdfplumber. Do not pass private athlete JSON files to the program generator. No original athlete data or reference branding image is included in the repository.
