# Vault Steward Walkthrough

These screenshots show the current macOS desktop flow. Vault Steward scans the
vault, prepares a bounded recommendation, shows the exact proposed change, and
edits the note only after explicit approval.

## 1. Start a vault check

Choose **Check vault** when you are ready to review the current vault.

![Vault Steward ready to start a vault check](images/vault-steward-start.png)

## 2. Prepare recommendations

Deterministic checks run first. When applicable, the configured model reviews
only bounded evidence and prepares safe recommendations.

![Vault Steward preparing safe recommendations](images/vault-steward-preparing.png)

## 3. Review and approve the exact change

The approval screen shows **Current** and **After** text, the affected note,
and the expected result. Nothing changes until **Apply** is selected.

![Vault Steward showing an exact Current and After repair preview before approval](images/vault-steward-approval-preview.png)

## 4. Confirm the result

After applying the selected fix, Vault Steward reports how many fixes and
notes changed and checks the vault again.

![Vault Steward confirming that one approved fix was applied](images/vault-steward-completed.png)
