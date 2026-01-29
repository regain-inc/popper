# Contributing to Popper

Thank you for your interest in contributing to Regain Popper™!

## How to Contribute

### Reporting Issues

- Search existing issues first to avoid duplicates
- Include your environment details and version number
- Provide minimal reproduction steps
- Describe expected vs actual behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Add tests if applicable
5. Ensure all tests pass (`bun run test`)
6. Ensure linting passes (`bun run lint`)
7. Submit a PR with a clear description

## Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/popper.git
cd popper

# Install dependencies
bun install

# Run tests
bun run test

# Start development server
bun run dev
```

## Code Style

- Run `bun run lint` before submitting
- Run `bun run check` for Biome checks
- Follow existing code patterns
- Use TypeScript for all new code
- Add comments for complex logic only

## Commit Messages

Use conventional commit format:

- `feat: Add new policy rule type`
- `fix: Handle edge case in DSL parser`
- `docs: Update README examples`
- `test: Add validation tests`
- `refactor: Simplify policy engine`

## Getting Help

- Open an issue for questions
- Join discussions in GitHub Discussions

---

## Contributor License Agreement (CLA)

By submitting a pull request or other contribution to this project, you agree to the following terms:

### Grant of Rights

1. **Copyright License**: You grant Regain, Inc. and recipients of software distributed by Regain, Inc. a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute your contributions and such derivative works.

2. **Patent License**: You grant Regain, Inc. and recipients of software distributed by Regain, Inc. a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer your contributions, where such license applies only to those patent claims licensable by you that are necessarily infringed by your contribution(s) alone or by combination of your contribution(s) with the project to which such contribution(s) were submitted.

3. **Relicensing Right**: You grant Regain, Inc. the right to relicense your contributions under different license terms, including but not limited to LGPL, AGPL, or commercial licenses, at Regain, Inc.'s sole discretion.

### Representations

4. **Original Work**: You represent that each of your contributions is your original creation and that you have the right to grant the above licenses.

5. **Third-Party Content**: If your contribution includes or is based on any third-party code, you will clearly identify it and provide all relevant license information.

6. **Employer Rights**: If your employer has rights to intellectual property that you create, you represent that you have received permission to make the contributions on behalf of that employer, or that your employer has waived such rights for your contributions.

### Why We Require This CLA

This CLA allows Regain, Inc. to:

- Protect the project from license-related legal issues
- Offer commercial licenses to organizations that cannot use open-source licenses
- Potentially change the license in the future if needed for the project's health
- Maintain flexibility to respond to evolving open-source ecosystem needs

Your contributions will always remain available under the current Apache 2.0 license for existing users. The CLA simply preserves our ability to offer additional licensing options.

### Agreeing to the CLA

By submitting a pull request, you indicate your agreement to this CLA. For significant contributions, we may ask you to sign a formal CLA document.
