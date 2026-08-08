@glasses @tasks
Feature: Deleting a task

  The last choice on a task's action menu, and the only one that removes something. It is confirmed
  first, because there is no undo on the glasses.

  Nothing is destroyed. The task goes to Notion's Bin, where it can be restored from any Notion
  app — the glasses just have no way to do that themselves.

  Background:
    Given I have opened a task's action menu

  Scenario: Confirming
    When I tap "Delete task"
    Then the glasses show the header "DELETE?"
    And the choices are "Confirm: " followed by the task's name, and "Cancel"
    When I tap the first choice
    Then the glasses show "DELETED"
    And "✓ " followed by the task's name
    And "Returning..."
    And the task is no longer in the list it came from
    And after 1.5 seconds that list reopens

  Scenario: The task goes to the Bin, not away for good
    When I confirm deleting a task
    Then it is moved to Notion's Bin
    And it can be restored from Notion

  Scenario: Cancelling leaves the task alone
    When I tap "Delete task"
    And I tap "Cancel"
    Then the task is still in its list
    And nothing was deleted

  Scenario: A deletion that fails keeps the task
    Given the deletion will not save
    When I tap "Delete task"
    And I tap the first choice
    Then the header shows "FAILED: " followed by what went wrong
    And the task is still in its list
    And I can try again

  Scenario: The confirmation does not say what kind of thing is being deleted
    When I tap "Delete task"
    Then the header reads "DELETE?"
    # The same question is asked for a note — it names the item, not its type.

  @known-gap
  Scenario: A deleted task can linger in another list
    Given a task that appears in two lists, and I opened both earlier
    When I delete it from one of them
    Then it disappears from that one
    But opening the other shows it again for a moment
    And it disappears once that list finishes checking for changes
