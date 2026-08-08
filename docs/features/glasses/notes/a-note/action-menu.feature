@glasses @notes
Feature: What can be done with a note

  Tapping a note anywhere in the app opens the same four choices, headed by the note's name.

  It is the task menu minus the two things a note has no concept of: a note is never "done", and
  it has no due date to change.

  Background:
    Given a note in any list

  Scenario: The action menu
    When I tap it
    Then the glasses show the note's name as the header
    And the choices are, in order:
      | Open page      |
      | Note Details   |
      | Change project |
      | Delete note    |

  Scenario: A note is never done and never due
    Given I have opened a note's action menu
    Then there is no "Mark as done" choice
    And there is no "Change due date" choice

  Scenario Outline: Each choice opens its flow
    Given I have opened a note's action menu
    When I tap "<choice>"
    Then <result>

    Examples:
      | choice         | result                             |
      | Open page      | the note opens in the page reader  |
      | Note Details   | the glasses show "NOTE DETAILS"    |
      | Change project | the "MOVE TO" project picker opens |
      | Delete note    | the glasses show "DELETE?"         |

  Scenario: Reading comes first
    Given I have opened a note's action menu
    Then the first choice is "Open page"
    # Unlike a task, where the details come first — a note is usually opened to read it.

  Scenario: A long name is shortened in the header
    Given a note whose name is wider than the display
    When I open its action menu
    Then the header shows as much of the name as fits, ending with "…"
    And "Note Details" shows the name in full

  Scenario: Backing out returns to the list the note came from
    Given I opened a note from one of the note lists
    When I double-tap
    Then that list reopens

  Scenario: A note opened from a tag returns to that tag's notes
    Given I opened a note from a tag's notes
    When I double-tap
    Then that tag's notes reopen

  Scenario: A note opened from inside a project returns there
    Given I opened a note from a project's notes
    When I double-tap
    Then that project's notes reopen
