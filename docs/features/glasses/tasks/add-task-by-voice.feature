@glasses @tasks
Feature: Adding a task by voice

  The one place the glasses create something rather than act on something that already exists.

  Voice input has to be set up on the phone first, and there are two ways to do it: an on-device
  model, where nothing that is said leaves the phone, or a cloud service the person supplies their
  own key for. Which one is in use changes nothing about the flow below — only whether audio
  leaves the device, which is stated where the choice is made.

  Recording stops by itself once talking stops, so the whole thing is: tap, speak, check what it
  heard, tap again.

  Background:
    Given I am on the "TASKS" menu
    And voice input is set up and ready

  Rule: The usual path

    Scenario: The screen invites a recording
      When I tap "Add Task (Voice)"
      Then the glasses show:
        """
        ADD TASK

        Tap to start recording.

        Speak your task — stops
        automatically on silence.

        Double-tap to go back.
        """

    Scenario: Recording
      Given I am on the Add Task screen
      When I tap
      Then the glasses start listening
      And the glasses show:
        """
        ADD TASK

        >>> RECORDING <<<

        Speak your task now...

        Stops on silence.
        Tap to stop early.
        """

    Scenario: Recording stops once I stop talking
      Given I am recording and have said something
      When I stay quiet for a moment
      Then the glasses stop listening
      And the glasses show:
        """
        ADD TASK

        Processing audio...
        Please wait.
        """

    Scenario: Checking what it heard
      Given I said "buy oat milk"
      When it finishes working out what I said
      Then the glasses show:
        """
        ADD TASK

        Confirm task:
        "buy oat milk"

        Tap to confirm.
        Double-tap to discard
        & re-record.
        """

    Scenario: Creating the task
      Given "buy oat milk" is waiting to be confirmed
      When I tap
      Then the glasses show "Saving task..." with a spinner in the header
      When the task is created
      Then the glasses show:
        """
        ADD TASK

        Task created!

        "buy oat milk"

        Tap to add another.
        Double-tap to go back.
        """

    Scenario: Adding another straight away
      Given a task was just created
      When I tap
      Then recording starts again

    Scenario: Finishing
      Given a task was just created
      When I double-tap
      Then the glasses show the header "TASKS"

  Rule: Recording can be stopped or abandoned

    Scenario: Stopping early
      Given I am recording
      When I tap
      Then the glasses stop listening
      And show "Processing audio..."

    Scenario: Recording stops after fifteen seconds regardless
      Given I am recording and never stop talking
      When 15 seconds pass
      Then the glasses stop listening and work out what I said

    Scenario: Discarding a transcript and starting over
      Given "buy oat milk" is waiting to be confirmed
      When I double-tap
      Then it is discarded
      And the glasses are ready to record again
      And I have not left the screen

    Scenario: Backing out mid-recording
      Given I am recording
      When I double-tap
      Then the glasses stop listening
      And show the header "TASKS"
      And nothing appears afterwards from what I had said

    Scenario: Leaving the app stops the recording
      Given I am recording
      When I leave the app
      Then the glasses stop listening

    Scenario: Closing the app stops the recording
      Given I am recording
      When the app closes
      Then the glasses stop listening

    Scenario: Taps are ignored while it is working
      Given the glasses show "Processing audio..."
      When I tap
      Then nothing happens

    Scenario: Taps are ignored while the task is being created
      Given the glasses show "Saving task..."
      When I tap
      Then nothing happens

  Rule: Before voice input is set up, the screen says what is missing

    The row stays in the Tasks menu either way — hiding it would mean nobody ever discovers the
    feature. Every fix is on the phone, so tapping here does nothing on purpose.

    Scenario: No voice mode chosen yet
      Given voice input is off
      When I tap "Add Task (Voice)"
      Then the glasses show:
        """
        ADD TASK

        Voice input is off.

        Choose a voice mode in
        Settings on your phone.

        Double-tap to go back.
        """

    Scenario: On-device mode, model not downloaded
      Given voice input is set to on-device
      But the voice model has not been downloaded
      When I tap "Add Task (Voice)"
      Then the glasses show:
        """
        ADD TASK

        Voice input needs a
        one-time download.

        Open Settings on your
        phone to download it.

        Double-tap to go back.
        """

    Scenario: Cloud mode, no API key
      Given voice input is set to cloud
      But no API key has been entered
      When I tap "Add Task (Voice)"
      Then the glasses show:
        """
        ADD TASK

        Cloud voice input needs
        a Soniox API key.

        Add it in Settings on
        your phone.

        Double-tap to go back.
        """

    Scenario: The model is still loading
      Given voice input is set to on-device
      And the voice model has been downloaded
      When I open Add Task before it has finished loading
      Then the glasses show:
        """
        ADD TASK

        Voice model loading...

        Double-tap to go back.
        """

    Scenario: Tapping does nothing until it is set up
      Given voice input is off
      And I am on the Add Task screen
      When I tap
      Then nothing happens
      And the glasses do not start listening

    Scenario: Leaving still works
      Given voice input is off
      And I am on the Add Task screen
      When I double-tap
      Then I go back to the "TASKS" menu

  Rule: Failures explain themselves and can be retried

    Scenario: The backend will not start
      Given voice input is set up
      But the speech backend cannot be reached
      When I tap to start recording
      Then the glasses show:
        """
        ADD TASK

        Error:
        Voice input unavailable. Check Settings, then try again.

        Tap to try again.
        Double-tap to go back.
        """
      When I fix it on my phone and tap again
      Then recording starts

    Scenario: Nothing was heard
      Given I tapped to record and said nothing
      When it finishes listening
      Then the glasses show:
        """
        ADD TASK

        Error:
        Couldn't hear anything. Tap to try again.

        Tap to try again.
        Double-tap to go back.
        """

    Scenario: The task could not be created
      Given "buy oat milk" is waiting to be confirmed
      And it will not save
      When I tap to confirm
      Then the glasses show "Error:" and what went wrong
      And what I said is discarded
      When I tap
      Then recording starts from scratch
      # A failed save means saying it again — the words are not kept.

    Scenario: Leaving after an error
      Given an error is showing
      When I double-tap
      Then the glasses show the header "TASKS"

  Rule: Nothing carries over between visits

    Scenario: Reopening the screen clears the last attempt
      Given I created a task earlier
      When I leave and open "Add Task (Voice)" again
      Then the glasses are ready to record
      And nothing from the earlier attempt is showing

    Scenario: Swiping does nothing here
      Given I am on the Add Task screen
      When I swipe down
      Then nothing happens
