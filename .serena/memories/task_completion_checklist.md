# Task Completion Checklist for DA_calc

## After implementing new features or changes:

### 1. Type Checking
- Run TypeScript compiler to check for type errors
- Ensure all new code has proper type definitions

### 2. Linting
- Run `npm run lint` to check code style
- Fix any ESLint warnings/errors

### 3. Testing
- Test data loading functions with actual data files
- Verify UTF-8 encoding works for Japanese text
- Check that all CSV/YAML files are properly parsed

### 4. Build Verification
- Run `npm run build` to ensure production build works
- Check for any build warnings or errors

### 5. Documentation
- Update type definitions if data structures change
- Add JSDoc comments for public functions
- Update memory files if project structure changes

### 6. Git Commit
- Stage relevant changes
- Write descriptive commit message
- Include what was changed and why

## Quality Checks
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Data loaders handle errors gracefully
- [ ] UTF-8 Japanese text displays correctly
- [ ] Build completes successfully