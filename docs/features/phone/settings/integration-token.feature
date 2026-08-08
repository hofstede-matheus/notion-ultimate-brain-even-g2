@phone @settings
Feature: Entering the Notion integration token

  The token drives everything else on the form: until Notion accepts one, there are no databases
  to choose from.

  Background:
    Given the settings form is open

  Scenario: The field explains what to share
    Then the phone shows the label "Integration Token"
    And below it: "In the integration's Content access tab, grant access to only the Ultimate Brain page — not the whole workspace. This keeps the token scoped and the database lists below short."

  Scenario: Nothing entered yet
    Then the phone shows "Enter your integration token to load its databases."
    And no dropdowns are shown

  Scenario: A recognised token is looked up
    When I enter a token beginning "ntn_"
    Then its databases are looked up

  Scenario: A legacy token is looked up too
    When I enter a token beginning "secret_"
    Then its databases are looked up

  @known-gap
  Scenario: A token in an unfamiliar format is not explained
    When I enter a token beginning with neither "ntn_" nor "secret_"
    Then nothing is looked up
    And the phone still shows "Enter your integration token to load its databases."
    And nothing says the format was not recognised

  Scenario: Typing waits for me to finish
    When I type a token character by character
    Then nothing is looked up while I am still typing
    When I stop for a moment
    Then it is looked up once

  Scenario: While it is being looked up
    When a lookup starts
    Then the phone shows "Loading databases…"

  Scenario: A token that works
    Given the token can see 6 databases
    When the lookup finishes
    Then the four dropdowns appear
    And each offers those databases

  Scenario: A token Notion rejects
    Given Notion will not accept the token
    When the lookup finishes
    Then the phone shows "Invalid Notion token" beneath the field
    And the field is marked as needing attention
    And no dropdowns are shown

  Scenario: The lookup fails for some other reason
    Given the databases cannot be loaded
    When the lookup finishes
    Then the phone shows "Failed to load databases" beneath the field
    And no dropdowns are shown

  Scenario: A token that works but has nothing shared with it
    Given the token can see no databases
    When the lookup finishes
    Then the phone shows "No databases found. Share your Tasks, Notes, Projects and Tags databases with this integration in Notion, then try again."
    And no dropdowns are shown
    And setup cannot be finished until the sharing is fixed in Notion

  Scenario: An answer for a token I have moved on from is ignored
    Given I entered one token and it is taking a while
    When I replace it with a different one
    And the first answer finally arrives
    Then it is ignored
    And the form reflects the token I typed last

  Scenario: Correcting a rejected token clears the message
    Given the phone shows "Invalid Notion token"
    When I edit the token
    Then the message disappears
    And it is looked up again once I stop typing
