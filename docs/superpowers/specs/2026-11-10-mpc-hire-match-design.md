# MPC hire-likelihood + ZipRecruiter-style fit

## Goal
Match placeable candidates to companies the way ZipRecruiter matches resumes to jobs: **skills, work history, and experience must fit the job need**, then rank by hire likelihood.

## Signals
### Resume profile (extracted)
- Skills (MIG/TIG, forklift, CDL, CNC, …)
- Job titles / work-history phrases
- Employers, years, certs

### Job profile (per company / prospect)
- Inferred job title from hiring fact + keywords
- Required skills from research notes, industries, keywords
- Hiring-now flag from posting / recruit language

### Fit labels (Zip-style)
- **Great Match** / **Good Match** / **Fair Match** (weak/no-overlap hidden)
- Match % from skill coverage + title/history alignment
- Matched skill chips + dashed gap chips

### Hire-likelihood boost (staffing desk)
1. Currently hiring similar role  
2. Previously billed / filled this trade  
3. Employs the skill set  

Closing/WARN plants demoted.

## UI
- Candidate skill strip at top of MPC results
- Each card: fit badge + %, job title, company, why, skill chips, research links
- No raw score soup

## Non-goals
- Inventing phones, contacts, or pay
- Live job-board scraping (research links remain)
- Full Zip marketplace engagement ML (thumbs, apply graph)
