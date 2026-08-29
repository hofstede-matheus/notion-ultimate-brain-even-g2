@glasses @notes
Feature: Filing a note under a project

  After picking a project the move is confirmed, then acknowledged before the list comes back.

  A note only leaves the list it was viewed from when the move genuinely takes it out of that
  list. The notes inbox means "not filed anywhere", so filing something removes it. A project's own
  notes list means "filed here", so moving it elsewhere removes it. Every other list keeps it.

  Background:
    Given I have opened a note's contextual menu and chosen "Change project"

  Scenario: Confirming a move
    When I tap one of the projects
    Then the glasses show the header "MOVE TO?"
    And the choices are "To " followed by that project's name, and "Cancel"
    When I tap the first choice
    Then the glasses show "MOVED"
    And "✓ " followed by the project's name
    And "Returning..."
    And after 1.5 seconds the list the note came from refreshes and reopens

  Scenario: Taking a note out of every project
    When I tap "— No project —"
    Then the glasses show the header "MOVE TO?"
    And the choices are "Clear project" and "Cancel"
    When I tap "Clear project"
    Then the glasses show "MOVED" and "✓ No project"

  Scenario: Filing a note from the notes inbox removes it from there
    Given the note came from the notes inbox
    When I file it under a project
    Then it is no longer in the notes inbox

  Scenario: Filing a note found under a tag leaves it there
    Given I opened the note from a tag's notes
    When I file it under a project
    Then it is still listed under that tag
    # A tag and a project are separate things — filing does not untag.

  Scenario: Moving a note out of the project I am looking at removes it from that list
    Given I am viewing a project's notes
    When I move one into a different project
    Then it is no longer in that list

  Scenario: Moving a note into the project I am already looking at keeps it
    Given I am viewing a project's notes
    When I move one into that same project
    Then it is still in that list

  Scenario: A move that fails can be tried again
    Given the move will not save
    When I confirm a move
    Then the header shows "FAILED: " followed by what went wrong
    And the two choices are unchanged
