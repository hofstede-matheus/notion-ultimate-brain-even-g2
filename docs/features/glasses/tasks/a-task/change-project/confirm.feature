@glasses @tasks
Feature: Filing a task under a project

  After picking a project the move is confirmed, then acknowledged before the list comes back.

  A task only leaves the list it was viewed from when the move genuinely takes it out of that
  list. The inbox means "not filed anywhere", so filing something removes it. A project's own task
  list means "filed here", so moving it elsewhere removes it. A list about dates keeps it.

  Background:
    Given I have opened a task's action menu and tapped "Change project"

  Scenario: Confirming a move
    When I tap one of the projects
    Then the glasses show the header "MOVE TO?"
    And the choices are "To " followed by that project's name, and "Cancel"
    When I tap the first choice
    Then the glasses show "MOVED"
    And "✓ " followed by the project's name
    And "Returning..."
    And after 1.5 seconds the list the task came from refreshes and reopens

  Scenario: Taking a task out of every project
    When I tap "— No project —"
    Then the glasses show the header "MOVE TO?"
    And the choices are "Clear project" and "Cancel"
    When I tap "Clear project"
    Then the glasses show "MOVED" and "✓ No project"

  Scenario: Filing a task from the inbox removes it from there
    Given the task came from the inbox
    When I file it under a project
    Then it is no longer in the inbox

  Scenario: Filing a task from a list about dates leaves it there
    Given the task came from a list defined by when it is due
    When I file it under a project
    Then it is still in that list
    # Such a list is about when a task is due, not where it is filed.

  Scenario: Moving a task out of the project I am looking at removes it from that list
    Given I am viewing a project's tasks
    When I move one into a different project
    Then it is no longer in that list

  Scenario: Taking a task out of the project I am looking at removes it too
    Given I am viewing a project's tasks
    When I clear one's project
    Then it is no longer in that list

  Scenario: Moving a task into the project I am already looking at keeps it
    Given I am viewing a project's tasks
    When I move one into that same project
    Then it is still in that list

  Scenario: A move that fails can be tried again
    Given the move will not save
    When I confirm a move
    Then the header shows "FAILED: " followed by what went wrong
    And the two choices are unchanged

  Scenario: A long project name is shortened on the confirmation
    Given I picked a project with a very long name
    Then the choice begins "To "
    And the name is shortened with a trailing "…"
