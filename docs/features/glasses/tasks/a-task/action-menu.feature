@glasses @tasks
Feature: What can be done with a task

  Tapping a task anywhere in the app opens it in the page reader directly. Tapping and holding
  it instead opens the OS's own contextual menu — a system-drawn overlay offering the same five
  things a task can do besides being read. Reading comes first among them and deleting comes
  last, so a misplaced tap is unlikely to remove anything.

  Background:
    Given a task in any list

  Scenario: Tapping opens the page
    When I tap it
    Then it opens in the page reader

  Scenario: Tapping and holding opens the contextual menu
    When I tap and hold it
    Then a menu opens over the current screen, offering:
      | Task Details    |
      | Change due date |
      | Change project  |
      | Mark as done    |
      | Delete task     |
    # There is no "Open page" here — a tap already does that.

  Scenario Outline: Each choice opens its flow
    Given I have opened a task's contextual menu
    When I choose "<choice>"
    Then <result>

    Examples:
      | choice          | result                              |
      | Task Details    | the glasses show "TASK DETAILS"     |
      | Change due date | the due-date calendar opens         |
      | Change project  | the "MOVE TO" project picker opens  |
      | Mark as done    | the glasses show "MARK AS DONE?"    |
      | Delete task     | the glasses show "DELETE?"          |

  Scenario: The menu acts on whichever task was highlighted
    Given more than one task in the list
    When I highlight a task and tap and hold it
    Then the menu's choices act on that task, not whichever one I looked at before

  Scenario: Backing out of a chosen flow returns to the list the task came from
    Given I opened a task's contextual menu from one of the task lists
    And I chose something that opened a screen
    When I double-tap
    Then that list reopens

  Scenario: A task opened from inside a project returns there
    Given I opened a task's contextual menu from a project's tasks
    And I chose something that opened a screen
    When I double-tap
    Then that project's tasks reopen

  Scenario: Finishing an action returns to the list
    Given I opened a task and acted on it
    When the confirmation clears
    Then the list the task came from reopens
