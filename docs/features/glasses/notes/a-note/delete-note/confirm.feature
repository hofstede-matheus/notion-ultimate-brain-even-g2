@glasses @notes
Feature: Deleting a note

  The last choice on a note's contextual menu, and the only one that removes something. It is
  confirmed first, because there is no undo on the glasses.

  Nothing is destroyed. The note goes to Notion's Bin, where it can be restored from any Notion
  app — the glasses just have no way to do that themselves.

  Background:
    Given I have opened a note's contextual menu

  Scenario: Confirming
    When I choose "Delete note"
    Then the glasses show the header "DELETE?"
    And the choices are "Confirm: " followed by the note's name, and "Cancel"
    When I tap the first choice
    Then the glasses show "DELETED"
    And "✓ " followed by the note's name
    And "Returning..."
    And the note is no longer in the list it came from
    And after 1.5 seconds that list reopens

  Scenario: The note goes to the Bin, not away for good
    When I confirm deleting a note
    Then it is moved to Notion's Bin
    And it can be restored from Notion

  Scenario: Cancelling leaves the note alone
    When I choose "Delete note"
    And I tap "Cancel"
    Then the note is still in its list
    And nothing was deleted

  Scenario: A deletion that fails keeps the note
    Given the deletion will not save
    When I choose "Delete note"
    And I tap the first choice
    Then the header shows "FAILED: " followed by what went wrong
    And the note is still in its list
    And I can try again

  Scenario: Deleting a note found under a tag
    Given I opened a note from a tag's notes
    When I delete it
    Then that tag's notes reopen
    And the note is no longer listed
