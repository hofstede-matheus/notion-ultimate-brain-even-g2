@glasses @projects
Feature: A project's notes

  Everything written down against a project, in one list. Anything found here behaves exactly as it
  would in a top-level note list.

  Background:
    Given I have opened a project

  Scenario: Opening them
    When I tap "Notes"
    Then the header is the project's name followed by " — NOTES"

  Scenario: A project with nothing written down
    Given a project with no notes
    When I open its notes
    Then the glasses show "No notes in this project."

  Scenario: Tapping a note opens the note menu
    Given I am viewing a project's notes
    When I tap one
    Then the glasses show that note's name as the header
    And the four note choices are listed

  Scenario: Going back returns to the project, not to its tasks
    Given I am viewing a project's notes
    When I double-tap
    Then the project itself reopens

  Scenario: Each project remembers its own notes
    Given I viewed one project's notes earlier
    When I open a different project's notes
    Then the first project's notes are never shown, not even for a moment
